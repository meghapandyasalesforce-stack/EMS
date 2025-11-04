import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaCheck, FaTrash } from 'react-icons/fa';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/v1/both/notification/user-notifications?limit=50&unreadOnly=true', { withCredentials: true });
      if (res.data?.success) setNotifications(res.data.notifications || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markAll = async () => {
    try {
      await axios.patch('/api/v1/both/notification/mark-all-read', {}, { withCredentials: true });
      // Do not batch-delete to avoid noisy 404s for legacy items; just clear UI
      setNotifications([]);
    } catch {}
  };

  const markOne = async (id) => {
    try {
      await axios.patch(`/api/v1/both/notification/${id}/read`, {}, { withCredentials: true });
      try { await axios.delete(`/api/v1/both/notification/${id}`, { withCredentials: true }); } catch {}
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch {}
  };

  const removeOne = async (id) => {
    try {
      await axios.delete(`/api/v1/both/notification/${id}`, { withCredentials: true });
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gray-50 p-5 ml-64 transition-all duration-300">
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-800">Notifications</h1>
          <div className="flex gap-2">
            <button onClick={load} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded">Refresh</button>
            <button onClick={markAll} className="px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded">Mark all read</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No notifications</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {notifications.map(n => (
              <li key={n._id} className={`flex items-start justify-between p-4 ${n.isRead ? '' : 'bg-blue-50'}`}>
                <div className="pr-4">
                  <p className="text-sm font-medium text-gray-800">{n.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  {!n.isRead && (
                    <button onClick={() => markOne(n._id)} className="p-2 rounded bg-blue-100 hover:bg-blue-200 text-blue-700" title="Mark as read">
                      <FaCheck />
                    </button>
                  )}
                  <button onClick={() => removeOne(n._id)} className="p-2 rounded bg-red-100 hover:bg-red-200 text-red-700" title="Delete">
                    <FaTrash />
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


