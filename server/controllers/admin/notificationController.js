import { sendBroadcastNotification, markNotificationAsRead, getUnreadNotificationCount } from "../../helpers/notificationService.js";
import Notification from "../../models/notification.model.js";
import User from "../../models/user.model.js";
import Employee from "../../models/employee.model.js";
import jwt from "jsonwebtoken";
import logger from "../../helpers/logger.js";
import { sendSuccess, sendError, sendNotFound, sendValidationError, sendInternalError, sendUnauthorized } from "../../helpers/responseHelper.js";

export const createNotification = async (req, res) => {
  try {
    const { message, type = 'announcement', priority = 'medium' } = req.body;

    // Simple validation
    if (!message) {
      return sendValidationError(res, { message: "Message is required" });
    }

    const sender = await User.findById(req.user._id);
    if (!sender) {
      return sendNotFound(res, "Sender");
    }

    // Use 'announcement' type for admin announcements
    await sendBroadcastNotification(sender, message, 'announcement', { priority });
    
    return sendSuccess(res, null, "Announcement sent successfully to all employees", 201);
  } catch (err) {
    logger.error('Error creating notification', { error: err.message, stack: err.stack });
    return sendInternalError(res, 'Failed to create notification', err);
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

  let lastCheck = new Date(Date.now() - 1000 * 60 * 5); // last 5 minutes
  let intervalId = null;

  // Function to send notifications
  const sendNotifications = async () => {
    try {
      // Build query: broadcasts OR user-specific notifications
      const query = {
        $or: [
          { isBroadcast: true }
        ]
      };
      
      // Add user-specific notifications if authenticated
      if (userId) {
        query.$or.push({ recipient: userId });
      }
      
      // Only get notifications created since last check
      query.createdAt = { $gt: lastCheck };
      
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(50); // Limit to prevent huge responses

      if (notifications.length > 0) {
        res.write(`data: ${JSON.stringify(notifications)}\n\n`);
        lastCheck = new Date(); // Update last check time
      }
      
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
    if (intervalId) {
      clearInterval(intervalId);
    }
    res.end();
  });

  // Handle errors that occur after connection is established
  req.on('error', (error) => {
    logger.error('SSE Request error', { error: error.message, stack: error.stack });
    if (intervalId) {
      clearInterval(intervalId);
    }
    res.end();
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
    const userId = req.user?._id || req.employee?._id;
    const { page = 1, limit = 20, type, unreadOnly = false } = req.query;

    const filter = {
      $or: [
        { recipient: userId },
        { isBroadcast: true }
      ]
    };

    if (type) filter.type = type;
    if (unreadOnly === 'true') filter.isRead = false;

    const notifications = await Notification.find(filter)
      .populate('sender', 'name email')
      .populate('recipient', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(filter);

    return sendSuccess(res, {
      notifications,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
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
    const userId = req.user?._id || req.employee?._id;

    await markNotificationAsRead(notificationId, userId);

    return sendSuccess(res, null, "Notification marked as read");
  } catch (error) {
    logger.error('Error marking notification as read', { error: error.message, stack: error.stack });
    return sendInternalError(res, 'Failed to mark notification as read', error);
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?._id || req.employee?._id;

    await Notification.updateMany(
      {
        $or: [
          { recipient: userId },
          { isBroadcast: true }
        ],
        isRead: false
      },
      { isRead: true }
    );

    return sendSuccess(res, null, "All notifications marked as read");
  } catch (error) {
    logger.error('Error marking all notifications as read', { error: error.message, stack: error.stack });
    return sendInternalError(res, 'Failed to mark all notifications as read', error);
  }
};

// Get unread notification count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?._id || req.employee?._id;
    const count = await getUnreadNotificationCount(userId);

    return sendSuccess(res, { unreadCount: count }, 'Unread count retrieved successfully');
  } catch (error) {
    logger.error('Error getting unread count', { error: error.message, stack: error.stack });
    return sendInternalError(res, 'Failed to get unread count', error);
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?._id || req.employee?._id;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      $or: [
        { recipient: userId },
        { sender: userId }
      ]
    });

    if (!notification) {
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