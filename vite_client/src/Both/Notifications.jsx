import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaCheck, FaTrash } from 'react-icons/fa';
import EnablePushNotificationsButton from '../components/EnablePushNotificationsButton';
import {
  fetchUserNotifications,
  fetchUnreadCount,
  markOneNotificationRead,
  markAllNotificationsRead,
  deleteNotificationById,
} from '../context/notificationSlice';

const Notifications = () => {
  const dispatch = useDispatch();
  const notifications = useSelector((state) => state.notifications.notifications || []);
  const unreadCount = useSelector((state) => state.notifications.unreadCount || 0);
  const loading = useSelector((state) => state.notifications.loading || false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'

  const load = () => {
    dispatch(fetchUserNotifications({ limit: 50, page: 1 }));
    dispatch(fetchUnreadCount());
  };

  useEffect(() => {
    load();
  }, [dispatch]);

  const markAll = async () => {
    try {
      await dispatch(markAllNotificationsRead()).unwrap();
    } catch {}
  };

  const markOne = async (id) => {
    try {
      await dispatch(markOneNotificationRead(id)).unwrap();
    } catch {}
  };

  const removeOne = async (id) => {
    try {
      await dispatch(deleteNotificationById(id)).unwrap();
    } catch {}
  };

  const displayedNotifications = activeTab === 'unread'
    ? notifications.filter((n) => n.isRead === false || n.read === false)
    : notifications;

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-5 transition-all duration-300">
      <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-200">
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-800">Notifications</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={load}
              className="px-3 py-2 text-sm sm:text-base bg-gray-100 hover:bg-gray-200 rounded transition"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={markAll}
              disabled={unreadCount === 0}
              className={`px-3 py-2 text-sm sm:text-base rounded transition text-white ${
                unreadCount === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-theme-secondary hover:bg-theme-primary'
              }`}
            >
              Mark all read
            </button>
          </div>
        </div>

        <EnablePushNotificationsButton />

        <div className="flex items-center gap-2 border-b border-gray-200 mb-4 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
              activeTab === 'all'
                ? 'bg-theme-primary text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unread')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
              activeTab === 'unread'
                ? 'bg-theme-primary text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading notifications...</div>
        ) : displayedNotifications.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            {activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {displayedNotifications.map((n) => (
              <li
                key={n._id || n.id}
                className={`flex items-start justify-between gap-3 p-4 ${
                  n.isRead || n.read ? '' : 'bg-theme-secondary/10'
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-sm font-medium text-gray-800 break-words">{n.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!n.isRead && !n.read && (
                    <button
                      type="button"
                      onClick={() => markOne(n._id || n.id)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded bg-theme-secondary/10 hover:bg-blue-200 text-theme-secondary"
                      title="Mark as read"
                    >
                      <FaCheck className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeOne(n._id || n.id)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded bg-red-100 hover:bg-red-200 text-red-700"
                    title="Delete"
                  >
                    <FaTrash className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Notifications;





