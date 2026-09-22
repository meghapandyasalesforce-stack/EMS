// redux/slices/notificationSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../utils/axios';
import { BOTH_NOTIFICATION_ENDPOINT } from '../utils/constant';

// Create new notification (admin only)
export const createNotification = createAsyncThunk(
  'notifications/create',
  async (message, thunkAPI) => {
    try {
      const res = await axios.post(
        `${BOTH_NOTIFICATION_ENDPOINT}/create-notification`,
        { message }
      );
      return res.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.error || error.response?.data?.message || error.message);
    }
  }
);

// Fetch user notifications list
export const fetchUserNotifications = createAsyncThunk(
  'notifications/fetchUserNotifications',
  async (params = { limit: 50, page: 1 }, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BOTH_NOTIFICATION_ENDPOINT}/user-notifications`, { params });
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch notifications'
      );
    }
  }
);

// Fetch unread notification count
export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BOTH_NOTIFICATION_ENDPOINT}/unread-count`);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch unread count'
      );
    }
  }
);

// Mark a single notification as read
export const markOneNotificationRead = createAsyncThunk(
  'notifications/markOneNotificationRead',
  async (notificationId, { rejectWithValue }) => {
    try {
      await axios.patch(`${BOTH_NOTIFICATION_ENDPOINT}/${notificationId}/read`, {});
      return notificationId;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to mark notification as read'
      );
    }
  }
);

// Mark all notifications as read
export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllNotificationsRead',
  async (_, { rejectWithValue }) => {
    try {
      await axios.patch(`${BOTH_NOTIFICATION_ENDPOINT}/mark-all-read`, {});
      return true;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to mark all notifications as read'
      );
    }
  }
);

// Delete notification by ID
export const deleteNotificationById = createAsyncThunk(
  'notifications/deleteNotificationById',
  async (notificationId, { rejectWithValue }) => {
    try {
      await axios.delete(`${BOTH_NOTIFICATION_ENDPOINT}/${notificationId}`);
      return notificationId;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to delete notification'
      );
    }
  }
);

// Delete / hide all notifications for current user
export const deleteAllNotifications = createAsyncThunk(
  'notifications/deleteAllNotifications',
  async (_, { rejectWithValue }) => {
    try {
      await axios.delete(`${BOTH_NOTIFICATION_ENDPOINT}/delete-all`);
      return true;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to delete all notifications'
      );
    }
  }
);

const normalizeNotificationsResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  return (
    payload?.notifications ||
    payload?.data?.notifications ||
    (Array.isArray(payload?.data) ? payload.data : [])
  );
};

const normalizeUnreadCountResponse = (payload) => {
  return (
    payload?.unreadCount ??
    payload?.count ??
    payload?.data?.unreadCount ??
    payload?.data?.count ??
    0
  );
};

const getNotificationId = (notification) => {
  return notification?._id || notification?.id;
};

const isNotificationUnread = (notification) => {
  return notification?.isRead === false || notification?.read === false;
};

const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  unreadLoading: false,
  status: 'idle',
  error: null,
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    receiveSocketNotification: (state, action) => {
      const incoming = action.payload?.data || action.payload;
      const incomingId = getNotificationId(incoming);
      if (!incomingId) return;

      const alreadyExists = state.notifications.some(
        (notification) => String(getNotificationId(notification)) === String(incomingId)
      );

      if (!alreadyExists) {
        state.notifications.unshift(incoming);
        if (isNotificationUnread(incoming)) {
          state.unreadCount += 1;
        } else if (incoming.isRead === undefined && incoming.read === undefined) {
          state.unreadCount += 1;
        }
      }
    },
    addNotification(state, action) {
      const incoming = Array.isArray(action.payload) ? action.payload : [action.payload];
      const existingIds = new Set(state.notifications.map((n) => String(getNotificationId(n) ?? '')));
      const merged = incoming.filter((n) => n && getNotificationId(n) && !existingIds.has(String(getNotificationId(n))));
      if (merged.length) {
        state.notifications.unshift(...merged);
        state.unreadCount = state.notifications.filter(isNotificationUnread).length;
      }
    },
    clearNotifications(state) {
      state.notifications = [];
      state.unreadCount = 0;
    },
    resetNotificationsState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // createNotification
      .addCase(createNotification.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(createNotification.fulfilled, (state, action) => {
        state.status = 'succeeded';
        if (action.payload) {
          const item = action.payload?.notification || action.payload;
          if (item) state.notifications.unshift(item);
        }
      })
      .addCase(createNotification.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })

      // fetchUserNotifications
      .addCase(fetchUserNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserNotifications.fulfilled, (state, action) => {
        const notifications = normalizeNotificationsResponse(action.payload);
        state.loading = false;
        state.notifications = notifications;
        state.unreadCount = notifications.filter(isNotificationUnread).length;
      })
      .addCase(fetchUserNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch notifications';
      })

      // fetchUnreadCount
      .addCase(fetchUnreadCount.pending, (state) => {
        state.unreadLoading = true;
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadLoading = false;
        state.unreadCount = Number(normalizeUnreadCountResponse(action.payload)) || 0;
      })
      .addCase(fetchUnreadCount.rejected, (state, action) => {
        state.unreadLoading = false;
        state.error = action.payload || 'Failed to fetch unread count';
      })

      // markOneNotificationRead
      .addCase(markOneNotificationRead.fulfilled, (state, action) => {
        const notificationId = action.payload;
        const notification = state.notifications.find(
          (item) => String(getNotificationId(item)) === String(notificationId)
        );
        if (notification && isNotificationUnread(notification)) {
          notification.isRead = true;
          notification.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })

      // markAllNotificationsRead
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.notifications = state.notifications.map((notification) => ({
          ...notification,
          isRead: true,
          read: true,
        }));
        state.unreadCount = 0;
      })

      // deleteNotificationById
      .addCase(deleteNotificationById.fulfilled, (state, action) => {
        const notificationId = action.payload;
        const notification = state.notifications.find(
          (item) => String(getNotificationId(item)) === String(notificationId)
        );
        const wasUnread = notification && isNotificationUnread(notification);
        state.notifications = state.notifications.filter(
          (item) => String(getNotificationId(item)) !== String(notificationId)
        );
        if (wasUnread) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })

      // deleteAllNotifications
      .addCase(deleteAllNotifications.fulfilled, (state) => {
        state.notifications = [];
        state.unreadCount = 0;
      });
  },
});

export const {
  receiveSocketNotification,
  addNotification,
  clearNotifications,
  resetNotificationsState,
} = notificationSlice.actions;

export default notificationSlice.reducer;

