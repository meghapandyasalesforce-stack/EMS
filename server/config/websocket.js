/**
 * WebSocket Server Configuration
 * Real-time notification delivery using Socket.IO
 */

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../helpers/logger.js';
import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';

let io = null;

/**
 * Initialize WebSocket server
 * @param {Object} httpServer - HTTP server instance
 * @returns {Object} Socket.IO server instance
 */
export const initializeWebSocket = (httpServer) => {
  if (io) {
    logger.warn('WebSocket server already initialized');
    return io;
  }

  // Create Socket.IO server with CORS configuration
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type']
    },
    transports: ['websocket', 'polling'], // Fallback to polling if WebSocket fails
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || 
                   socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
                   socket.handshake.query?.token;

      if (!token) {
        logger.warn('WebSocket connection rejected: No token provided', {
          socketId: socket.id,
          ip: socket.handshake.address
        });
        return next(new Error('Authentication required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user or employee based on token
      let user = null;
      let userType = null;
      let organizationId = null;

      if (decoded.userId) {
        // Admin/HR user
        user = await User.findById(decoded.userId).select('_id name email role organizationId isActive');
        if (user) {
          userType = 'User';
          organizationId = user.organizationId;
        }
      } else if (decoded.employeeId) {
        // Employee
        user = await Employee.findById(decoded.employeeId).select('_id name email organizationId isActive');
        if (user) {
          userType = 'Employee';
          organizationId = user.organizationId;
        }
      }

      if (!user || !user.isActive) {
        logger.warn('WebSocket connection rejected: Invalid or inactive user', {
          socketId: socket.id,
          userId: decoded.userId || decoded.employeeId
        });
        return next(new Error('Invalid or inactive user'));
      }

      if (!organizationId) {
        logger.warn('WebSocket connection rejected: No organization ID', {
          socketId: socket.id,
          userId: user._id
        });
        return next(new Error('Organization ID required'));
      }

      // Attach user info to socket
      socket.userId = user._id.toString();
      socket.userType = userType;
      socket.organizationId = organizationId.toString();
      socket.userRole = decoded.role || null;
      socket.userName = user.name || user.email;

      logger.info('WebSocket connection authenticated', {
        socketId: socket.id,
        userId: socket.userId,
        userType: socket.userType,
        organizationId: socket.organizationId,
        role: socket.userRole
      });

      next();
    } catch (error) {
      logger.error('WebSocket authentication error', {
        error: error.message,
        socketId: socket.id,
        ip: socket.handshake.address
      });
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info('WebSocket client connected', {
      socketId: socket.id,
      userId: socket.userId,
      organizationId: socket.organizationId
    });

    // Join organization room for organization-wide broadcasts
    socket.join(`org:${socket.organizationId}`);
    
    // Join user-specific room for personal notifications
    socket.join(`user:${socket.userId}`);

    // Join role-based rooms if applicable
    if (socket.userRole) {
      socket.join(`role:${socket.userRole}`);
    }

    // Send connection confirmation
    socket.emit('connected', {
      message: 'WebSocket connection established',
      userId: socket.userId,
      organizationId: socket.organizationId,
      timestamp: new Date().toISOString()
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        reason
      });
    });

    // Handle ping/pong for keepalive
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Handle notification read acknowledgment
    socket.on('notification:read', async (data) => {
      try {
        const { notificationId } = data;
        if (notificationId) {
          const Notification = (await import('../models/notification.model.js')).default;
          await Notification.findOneAndUpdate(
            { _id: notificationId, recipient: socket.userId },
            { isRead: true }
          );
          logger.debug('Notification marked as read via WebSocket', {
            notificationId,
            userId: socket.userId
          });
        }
      } catch (error) {
        logger.error('Error marking notification as read', {
          error: error.message,
          notificationId: data?.notificationId
        });
      }
    });

    // Handle subscription to specific notification types
    socket.on('subscribe', (data) => {
      const { types } = data || {};
      if (Array.isArray(types)) {
        types.forEach(type => {
          socket.join(`notification:${type}`);
          logger.debug('Client subscribed to notification type', {
            socketId: socket.id,
            type
          });
        });
      }
    });

    // Handle unsubscription from notification types
    socket.on('unsubscribe', (data) => {
      const { types } = data || {};
      if (Array.isArray(types)) {
        types.forEach(type => {
          socket.leave(`notification:${type}`);
          logger.debug('Client unsubscribed from notification type', {
            socketId: socket.id,
            type
          });
        });
      }
    });
  });

  logger.info('WebSocket server initialized');
  return io;
};

/**
 * Get Socket.IO instance
 * @returns {Object} Socket.IO server instance
 */
export const getIO = () => {
  if (!io) {
    logger.error('WebSocket server not initialized. Call initializeWebSocket first.');
    throw new Error('WebSocket server not initialized');
  }
  return io;
};

/**
 * Send notification to specific user via WebSocket
 * @param {String} userId - User/Employee ID
 * @param {Object} notification - Notification object
 */
export const sendNotificationToUser = (userId, notification) => {
  try {
    if (!io) {
      logger.warn('WebSocket server not initialized, skipping notification');
      return;
    }

    const room = `user:${userId}`;
    io.to(room).emit('notification', {
      type: 'notification',
      data: notification
    });

    logger.debug('Notification sent via WebSocket', {
      userId,
      notificationId: notification._id || notification.id,
      type: notification.type
    });
  } catch (error) {
    logger.error('Error sending notification via WebSocket', {
      error: error.message,
      userId,
      notificationId: notification._id || notification.id
    });
  }
};

/**
 * Send broadcast notification to organization via WebSocket
 * @param {String} organizationId - Organization ID
 * @param {Object} notification - Notification object
 */
export const sendBroadcastNotification = (organizationId, notification) => {
  try {
    if (!io) {
      logger.warn('WebSocket server not initialized, skipping broadcast');
      return;
    }

    const room = `org:${organizationId}`;
    io.to(room).emit('notification', {
      type: 'notification',
      data: notification
    });

    logger.debug('Broadcast notification sent via WebSocket', {
      organizationId,
      notificationId: notification._id || notification.id,
      type: notification.type
    });
  } catch (error) {
    logger.error('Error sending broadcast notification via WebSocket', {
      error: error.message,
      organizationId,
      notificationId: notification._id || notification.id
    });
  }
};

/**
 * Send notification to specific role via WebSocket
 * @param {String} role - User role (admin, hr, employee)
 * @param {String} organizationId - Organization ID
 * @param {Object} notification - Notification object
 */
export const sendNotificationToRole = (role, organizationId, notification) => {
  try {
    if (!io) {
      logger.warn('WebSocket server not initialized, skipping role notification');
      return;
    }

    // Send to users with specific role in the organization
    const room = `role:${role}`;
    io.to(room).emit('notification', {
      type: 'notification',
      data: notification
    });

    logger.debug('Role-based notification sent via WebSocket', {
      role,
      organizationId,
      notificationId: notification._id || notification.id
    });
  } catch (error) {
    logger.error('Error sending role-based notification via WebSocket', {
      error: error.message,
      role,
      organizationId
    });
  }
};

/**
 * Send notification to specific notification type subscribers
 * @param {String} notificationType - Notification type (e.g., 'task_update', 'leave_request')
 * @param {Object} notification - Notification object
 */
export const sendNotificationToType = (notificationType, notification) => {
  try {
    if (!io) {
      logger.warn('WebSocket server not initialized, skipping type notification');
      return;
    }

    const room = `notification:${notificationType}`;
    io.to(room).emit('notification', {
      type: 'notification',
      data: notification
    });

    logger.debug('Type-based notification sent via WebSocket', {
      notificationType,
      notificationId: notification._id || notification.id
    });
  } catch (error) {
    logger.error('Error sending type-based notification via WebSocket', {
      error: error.message,
      notificationType
    });
  }
};

/**
 * Get connected clients count
 * @returns {Object} Connection statistics
 */
export const getConnectionStats = () => {
  if (!io) {
    return { connected: 0, rooms: 0 };
  }

  const sockets = io.sockets.sockets;
  const rooms = io.sockets.adapter.rooms;

  return {
    connected: sockets.size,
    rooms: rooms.size,
    timestamp: new Date().toISOString()
  };
};

export default {
  initializeWebSocket,
  getIO,
  sendNotificationToUser,
  sendBroadcastNotification,
  sendNotificationToRole,
  sendNotificationToType,
  getConnectionStats
};

