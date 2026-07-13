import React, { useEffect, useState } from 'react';
import axios from '../utils/axios';
import { BOTH_NOTIFICATION_ENDPOINT } from '../utils/constant';
import { FaCheck, FaTrash } from 'react-icons/fa';
import EnablePushNotificationsButton from '../components/EnablePushNotificationsButton';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BOTH_NOTIFICATION_ENDPOINT}/user-notifications?limit=50&unreadOnly=true`);
      if (res.data?.success) setNotifications(res.data.notifications || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markAll = async () => {
    try {
      await axios.patch(`${BOTH_NOTIFICATION_ENDPOINT}/mark-all-read`, {});
      // Do not batch-delete to avoid noisy 404s for legacy items; just clear UI
      setNotifications([]);
    } catch {}
  };

  const markOne = async (id) => {
    try {
      await axios.patch(`${BOTH_NOTIFICATION_ENDPOINT}/${id}/read`, {});
      try { await axios.delete(`${BOTH_NOTIFICATION_ENDPOINT}/${id}`); } catch {}
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch {}
  };

  const removeOne = async (id) => {
    try {
      await axios.delete(`${BOTH_NOTIFICATION_ENDPOINT}/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
      <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-800">Notifications</h1>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={load} className="px-3 py-2 text-sm sm:text-base bg-gray-100 hover:bg-gray-200 rounded transition">Refresh</button>
            <button onClick={markAll} className="px-3 py-2 text-sm sm:text-base bg-theme-secondary hover:bg-theme-primary text-white rounded transition">Mark all read</button>
          </div>
        </div>

        <EnablePushNotificationsButton />

        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No notifications</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {notifications.map(n => (
              <li key={n._id} className={`flex items-start justify-between gap-3 p-4 ${n.isRead ? '' : 'bg-theme-secondary/10'}`}>
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-sm font-medium text-gray-800 break-words">{n.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => markOne(n._id)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded bg-theme-secondary/10 hover:bg-blue-200 text-theme-secondary"
                      title="Mark as read"
                    >
                      <FaCheck className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeOne(n._id)}
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


