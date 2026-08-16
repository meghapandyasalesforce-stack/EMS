import {
  sendBroadcastNotification,
  markNotificationAsRead,
  buildUserNotificationFilter,
  withEffectiveReadState,
} from "../../helpers/notificationService.js";
import Notification from "../../models/notification.model.js";
import User from "../../models/user.model.js";
import Employee from "../../models/employee.model.js";
import jwt from "jsonwebtoken";
import logger from "../../helpers/logger.js";
import { sendSuccess, sendError, sendNotFound, sendValidationError, sendInternalError, sendUnauthorized } from "../../helpers/responseHelper.js";

/** Resolve all IDs that may own notifications for the current session (User and/or Employee). */
const resolveNotificationRecipientIds = async (req) => {
  const ids = new Set();
  const primaryId = req.user?._id || req.employee?._id;
  if (primaryId) ids.add(primaryId.toString());
  if (req.employee?._id) ids.add(req.employee._id.toString());
  if (req.employeeProfileId) ids.add(req.employeeProfileId.toString());

  try {
    if (req.user?._id) {
      const linkedEmployee = await Employee.findOne({ userId: req.user._id })
        .select('_id')
        .lean();
      if (linkedEmployee?._id) ids.add(linkedEmployee._id.toString());
    }
    if (req.employee?.userId) {
      ids.add(req.employee.userId.toString());
    } else if (req.employee?._id) {
      const employee = await Employee.findById(req.employee._id).select('userId').lean();
      if (employee?.userId) ids.add(employee.userId.toString());
    }
  } catch (error) {
    logger.warn('Failed to expand notification recipient IDs', { error: error.message });
  }

  return [...ids];
};

const resolveOrganizationId = async (req) => {
  let organizationId = req.user?.organizationId || req.employee?.organizationId || req.organizationId;
  if (organizationId) return organizationId;

  try {
    if (req.user?._id) {
      const user = await User.findById(req.user._id).select('organizationId').lean();
      organizationId = user?.organizationId;
    } else if (req.employee?._id) {
      const employee = await Employee.findById(req.employee._id).select('organizationId').lean();
      organizationId = employee?.organizationId;
    }
  } catch (dbError) {
    logger.error('Error loading organizationId from database', { error: dbError.message });
  }
  return organizationId || null;
};

const resolveActorIdentity = (req) => {
  if (req.user?._id) {
    return { primaryId: req.user._id, userType: 'User' };
  }
  if (req.employee?._id) {
    return { primaryId: req.employee._id, userType: 'Employee' };
  }
  return { primaryId: null, userType: 'User' };
};

export const createNotification = async (req, res) => {
  try {
    const { message, type = 'announcement', priority = 'medium' } = req.body;

    if (!message) {
      return sendValidationError(res, { message: "Message is required" });
    }

    let sender = null;
    if (req.user?._id) {
      sender = await User.findById(req.user._id);
    }
    if (!sender && req.employee?._id) {
      sender = await Employee.findById(req.employee._id);
    }
    if (!sender) {
      return sendNotFound(res, "Sender");
    }

    await sendBroadcastNotification(sender, message, 'announcement', { priority });
    
    return sendSuccess(res, null, "Announcement sent successfully to all employees", 201);
  } catch (err) {
    logger.error('Error creating notification', { error: err.message, stack: err.stack });
    return sendInternalError(res, 'Failed to create notification', err);
  }
};

/** Broadcast announcements — list for dashboard history (organization-wide with pagination) */
export const getSentAnnouncements = async (req, res) => {
  try {
    const actorId = req.user?._id || req.employee?._id;
    if (!actorId) {
      return sendUnauthorized(res, 'Authentication required');
    }

    const organizationId = await resolveOrganizationId(req);
    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    const { page = 1, limit = 20, scope } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return sendError(res, 'Invalid page number', 400, 'INVALID_PAGE');
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return sendError(res, 'Invalid limit (must be between 1 and 100)', 400, 'INVALID_LIMIT');
    }

    // Default: all org announcement broadcasts. Optional scope=mine filters to current sender.
    const filter = {
      organizationId,
      isBroadcast: true,
      type: 'announcement',
    };
    if (scope === 'mine') {
      filter.sender = actorId;
    }

    const announcements = await Notification.find(filter)
      .populate('sender', 'name email')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const total = await Notification.countDocuments(filter);

    return sendSuccess(
      res,
      {
        announcements,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum) || 1,
          total,
        },
      },
      'Sent announcements retrieved successfully'
    );
  } catch (error) {
    logger.error('Error getting sent announcements', { error: error.message, stack: error.stack });
    return sendInternalError(res, 'Failed to get sent announcements', error);
  }
};

/** Seen / unseen receipts for a single announcement broadcast (org-scoped). */
export const getAnnouncementReceipts = async (req, res) => {
  try {
    const actorId = req.user?._id || req.employee?._id;
    if (!actorId) {
      return sendUnauthorized(res, 'Authentication required');
    }

    const organizationId = await resolveOrganizationId(req);
    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    const { notificationId } = req.params;
    const announcement = await Notification.findOne({
      _id: notificationId,
      organizationId,
      isBroadcast: true,
      type: 'announcement',
    }).lean();

    if (!announcement) {
      return sendNotFound(res, 'Announcement');
    }

    const audience = await Employee.find({
      organizationId,
      status: 'active',
    })
      .select('_id name lastName email userId')
      .lean();

    const receiptById = new Map();
    for (const receipt of announcement.readReceipts || []) {
      const key = String(receipt.userId);
      if (!receiptById.has(key)) {
        receiptById.set(key, receipt);
      }
    }

    const seen = [];
    const notSeen = [];

    for (const emp of audience) {
      const empId = String(emp._id);
      const userId = emp.userId ? String(emp.userId) : null;
      const receipt = receiptById.get(empId) || (userId ? receiptById.get(userId) : null);
      const person = {
        _id: emp._id,
        name: [emp.name, emp.lastName].filter(Boolean).join(' ').trim() || emp.email || 'Employee',
        email: emp.email || null,
      };
      if (receipt) {
        seen.push({ ...person, readAt: receipt.readAt });
      } else {
        notSeen.push(person);
      }
    }

    return sendSuccess(
      res,
      {
        announcementId: announcement._id,
        message: announcement.message,
        createdAt: announcement.createdAt,
        audienceTotal: audience.length,
        seenCount: seen.length,
        notSeenCount: notSeen.length,
        seen,
        notSeen,
      },
      'Announcement receipts retrieved successfully'
    );
  } catch (error) {
    logger.error('Error getting announcement receipts', { error: error.message, stack: error.stack });
    return sendInternalError(res, 'Failed to get announcement receipts', error);
  }
};

// Get notifications for current user (including broadcasts) - SSE endpoint
export const getNotifications = async (req, res) => {
  // Set CORS headers FIRST (before any other headers or errors)
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();
  
  if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV === "development")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  
  // Set headers for Server-Sent Events (SSE) - MUST be text/event-stream
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx/proxy
  
  // Flush headers immediately to establish SSE connection
  res.flushHeaders();

  // Try to authenticate user (optional - for personalized notifications)
  let userId = null;
  let userRole = null;
  
  try {
    // Check for token in cookie or Authorization header
    let token = req.cookies?.jwt;
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
      userRole = decoded.role;
    }
  } catch (authError) {
    // Authentication failed - continue without user ID (will only get broadcasts)
    logger.warn('SSE: Authentication failed, continuing with broadcasts only', { error: authError.message });
  }

  let lastCheck = new Date(0);
  let isFirstPoll = true;
  let intervalId = null;
  const HISTORY_MS = 1000 * 60 * 60 * 24 * 30; // seed last 30 days on first poll

  // Function to send notifications
  const sendNotifications = async () => {
    try {
      // Build query: broadcasts OR user-specific notifications
      const baseOr = [{ isBroadcast: true }];
      if (userId) {
        baseOr.push({ recipient: userId });
      }

      let notifications;
      if (isFirstPoll) {
        isFirstPoll = false;
        const since = new Date(Date.now() - HISTORY_MS);
        notifications = await Notification.find({
          $or: baseOr,
          createdAt: { $gte: since },
        })
          .sort({ createdAt: -1 })
          .limit(50);
      } else {
        notifications = await Notification.find({
          $or: baseOr,
          createdAt: { $gt: lastCheck },
        })
          .sort({ createdAt: -1 })
          .limit(50);
      }

      if (notifications.length > 0) {
        res.write(`data: ${JSON.stringify(notifications)}\n\n`);
      }
      // Always advance — avoids getting stuck when the prior window had zero rows
      lastCheck = new Date();
      
      // Send keepalive ping every 30 seconds to prevent connection timeout
      res.write(': keepalive\n\n');
    } catch (error) {
      logger.error('SSE Polling error', { error: error.message, stack: error.stack });
      // Send error as SSE event (not JSON response)
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to fetch notifications' })}\n\n`);
    }
  };

  // Send initial connection confirmation
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'SSE connection established' })}\n\n`);

  // Initial send
  try {
    await sendNotifications();
  } catch (initialError) {
    logger.error('SSE Initial error', { error: initialError.message, stack: initialError.stack });
    // Send error as SSE event, don't return JSON
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to initialize notifications' })}\n\n`);
    res.end();
    return;
  }

  // Set up polling interval (every 3 seconds)
  intervalId = setInterval(sendNotifications, 3000);

  // Clean up on client disconnect
  req.on('close', () => {
    logger.debug('SSE connection closed by client');
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    // Only end response if it hasn't been ended already
    if (!res.headersSent || res.writable) {
      res.end();
    }
  });

  // Handle errors that occur after connection is established
  req.on('error', (error) => {
    // 'aborted' errors are normal when client disconnects - don't log as error
    if (error.message === 'aborted' || error.code === 'ECONNRESET' || error.message?.includes('aborted')) {
      logger.debug('SSE client disconnected', { 
        error: error.message,
        note: 'This is normal when user navigates away or closes the connection'
      });
    } else {
      // Only log actual errors
      logger.error('SSE Request error', { error: error.message, stack: error.stack });
    }
    
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    // Only end response if it hasn't been ended already
    if (!res.headersSent || res.writable) {
      res.end();
    }
  });
};

// Helper function to get allowed origins (same as in server.js)
const getAllowedOrigins = () => {
  const origins = [];
  
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  if (process.env.ALLOWED_ORIGINS) {
    origins.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()));
  }
  
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:5173', 'http://localhost:3000');
  }
  
  if (process.env.NODE_ENV === 'production') {
    origins.push('https://paarsiv.vercel.app');
  }
  
  return origins.length > 0 ? origins : ['http://localhost:5173'];
};

// Get notifications for current user (regular API endpoint)
export const getUserNotifications = async (req, res) => {
  try {
    const recipientIds = await resolveNotificationRecipientIds(req);
    
    if (!recipientIds.length) {
      return sendError(res, 'User ID is required', 401, 'USER_NOT_FOUND');
    }

    const { page = 1, limit = 20, type, unreadOnly = false } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    
    if (isNaN(pageNum) || pageNum < 1) {
      return sendError(res, 'Invalid page number', 400, 'INVALID_PAGE');
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return sendError(res, 'Invalid limit (must be between 1 and 100)', 400, 'INVALID_LIMIT');
    }

    const organizationId = await resolveOrganizationId(req);
    
    if (organizationId && !/^[0-9a-fA-F]{24}$/.test(organizationId.toString())) {
      return sendError(res, 'Invalid organization ID format', 400, 'INVALID_ORGANIZATION_ID');
    }
    
    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    const filter = buildUserNotificationFilter(organizationId, recipientIds, {
      unreadOnly: unreadOnly === 'true' || unreadOnly === true,
    });

    if (type) filter.type = type;

    const notifications = await Notification.find(filter)
      .populate('sender', 'name email')
      .populate('recipient', 'name email')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const total = await Notification.countDocuments(filter);
    const withReadState = withEffectiveReadState(notifications, recipientIds);

    return sendSuccess(res, {
      notifications: withReadState,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        total
      }
    }, 'Notifications retrieved successfully');
  } catch (error) {
    logger.error('Error getting user notifications', { error: error.message, stack: error.stack });
    return sendInternalError(res, 'Failed to get notifications', error);
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const recipientIds = await resolveNotificationRecipientIds(req);
    if (!recipientIds.length) {
      return sendError(res, 'User ID is required', 401, 'USER_NOT_FOUND');
    }

    const organizationId = await resolveOrganizationId(req);
    const { primaryId, userType } = resolveActorIdentity(req);

    const result = await markNotificationAsRead(notificationId, recipientIds, {
      organizationId,
      userType,
      primaryId,
    });

    if (!result.success) {
      if (result.reason === 'NOT_FOUND') {
        return sendNotFound(res, 'Notification');
      }
      return sendError(res, 'Unable to mark notification as read', 400, result.reason || 'MARK_READ_FAILED');
    }

    return sendSuccess(res, null, "Notification marked as read");
  } catch (error) {
    logger.error('Error marking notification as read', { error: error.message, stack: error.stack });
    return sendInternalError(res, 'Failed to mark notification as read', error);
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const recipientIds = await resolveNotificationRecipientIds(req);
    if (!recipientIds.length) {
      return sendError(res, 'User ID is required', 401, 'USER_NOT_FOUND');
    }

    const organizationId = await resolveOrganizationId(req);
    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    const { primaryId, userType } = resolveActorIdentity(req);

    // Personal notifications: flip isRead for this person's recipient IDs only
    await Notification.updateMany(
      {
        organizationId,
        recipient: { $in: recipientIds },
        isBroadcast: { $ne: true },
        isRead: false,
      },
      { isRead: true }
    );

    // Broadcasts: add per-user read receipts (never flip shared isRead)
    const unreadBroadcasts = await Notification.find({
      organizationId,
      isBroadcast: true,
      'readReceipts.userId': { $nin: recipientIds },
      'hiddenBy.userId': { $nin: recipientIds },
    }).select('_id');

    if (unreadBroadcasts.length) {
      const receipt = {
        userId: primaryId || recipientIds[0],
        userType,
        readAt: new Date(),
      };
      await Notification.updateMany(
        { _id: { $in: unreadBroadcasts.map((n) => n._id) } },
        { $push: { readReceipts: receipt } }
      );
    }

    return sendSuccess(res, null, "All notifications marked as read");
  } catch (error) {
    logger.error('Error marking all notifications as read', { error: error.message, stack: error.stack });
    return sendInternalError(res, 'Failed to mark all notifications as read', error);
  }
};

// Get unread notification count
export const getUnreadCount = async (req, res) => {
  try {
    const recipientIds = await resolveNotificationRecipientIds(req);
    
    if (!recipientIds.length) {
      return sendError(res, 'User ID is required', 401, 'USER_NOT_FOUND');
    }

    const organizationId = await resolveOrganizationId(req);
    
    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    const filter = buildUserNotificationFilter(organizationId, recipientIds, { unreadOnly: true });
    const count = await Notification.countDocuments(filter);

    return sendSuccess(res, { unreadCount: count }, 'Unread count retrieved successfully');
  } catch (error) {
    logger.error('Error getting unread count', { error: error.message, stack: error.stack });
    return sendInternalError(res, 'Failed to get unread count', error);
  }
};

// Delete notification (personal: hard delete; broadcast: per-user hide only)
export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const recipientIds = await resolveNotificationRecipientIds(req);
    if (!recipientIds.length) {
      return sendError(res, 'User ID is required', 401, 'USER_NOT_FOUND');
    }

    const organizationId = await resolveOrganizationId(req);
    const { primaryId, userType } = resolveActorIdentity(req);

    const query = {
      _id: notificationId,
      $or: [
        { recipient: { $in: recipientIds }, isBroadcast: { $ne: true } },
        { isBroadcast: true },
        { sender: { $in: recipientIds } },
      ],
    };
    if (organizationId) query.organizationId = organizationId;

    const notification = await Notification.findOne(query);
    if (!notification) {
      return sendNotFound(res, "Notification");
    }

    if (notification.isBroadcast) {
      const alreadyHidden = (notification.hiddenBy || []).some((h) =>
        recipientIds.includes(String(h.userId))
      );
      if (!alreadyHidden) {
        await Notification.updateOne(
          { _id: notificationId },
          {
            $push: {
              hiddenBy: {
                userId: primaryId || recipientIds[0],
                userType,
                hiddenAt: new Date(),
              },
            },
          }
        );
      }
      return sendSuccess(res, null, "Notification deleted successfully");
    }

    const deleted = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: { $in: recipientIds },
      isBroadcast: { $ne: true },
    });

    if (!deleted) {
      return sendNotFound(res, "Notification");
    }

    return sendSuccess(res, null, "Notification deleted successfully");
  } catch (error) {
    logger.error('Error deleting notification', { error: error.message, stack: error.stack });
    return sendInternalError(res, 'Failed to delete notification', error);
  }
};

// Employee action: notify all admins when employee taps "Back" in attendance
export const notifyAdminsOnEmployeeBack = async (req, res) => {
  try {
    const employeeId = req.employee?._id;
    if (!employeeId) {
      return sendUnauthorized(res, 'Unauthorized');
    }

    const employee = await Employee.findById(employeeId).select('name email');
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');

    const message = `${employee?.name || 'An employee'} navigated back from Attendance`;

    await Promise.all(admins.map(a => Notification.create({
      recipient: a._id,
      sender: employeeId,
      message,
      type: 'system',
      priority: 'low',
      metadata: { source: 'attendance', action: 'back' }
    })));

    return sendSuccess(res, null, 'Admins notified');
  } catch (error) {
    logger.error('Error notifying admins', { error: error.message, stack: error.stack });
    return sendInternalError(res, 'Failed to notify admins', error);
  }
};