import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addNotification } from '../../context/notificationSlice';
import { BOTH_NOTIFICATION_ENDPOINT } from '../../utils/constant';

const NotificationFeed = () => {
  const dispatch = useDispatch();
  const allNotifications = useSelector((state) => state.notifications.list || []);
  const [visibleNotifications, setVisibleNotifications] = useState([]);
  const [recentIds, setRecentIds] = useState(new Set());
 const [readIds, setReadIds] = useState(() => {
  try {
    const saved = localStorage.getItem('readNotifications');
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
});


  useEffect(() => {
    const eventSource = new EventSource(`${BOTH_NOTIFICATION_ENDPOINT}/get-all-notification`, {
      withCredentials: true,
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          dispatch(addNotification(data));

          const filtered = data.filter(n => !readIds.has(n._id));
          setVisibleNotifications((prev) => [...prev, ...filtered]);

          const newIds = filtered.map((n) => n._id);
          setRecentIds((prev) => new Set([...prev, ...newIds]));
          setTimeout(() => {
            setRecentIds((prev) => {
              const updated = new Set(prev);
              newIds.forEach((id) => updated.delete(id));
              return updated;
            });
          }, 3000);
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      eventSource.close();
    };

    return () => eventSource.close();
  }, [dispatch, readIds]);

  const handleRead = (id) => {
    const updated = visibleNotifications.filter((n) => n._id !== id);
    setVisibleNotifications(updated);

    const newReadIds = new Set(readIds);
    newReadIds.add(id);
    setReadIds(newReadIds);
    localStorage.setItem('readNotifications', JSON.stringify([...newReadIds]));
  };

  // Filter again on page load (not just on SSE)
  useEffect(() => {
    const freshVisible = allNotifications.filter(n => !readIds.has(n._id));
    setVisibleNotifications(freshVisible);
  }, [allNotifications, readIds]);

  return (
    <div className="p-6">
      {visibleNotifications.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.5 19.5a3 3 0 01-3-3V6a3 3 0 013-3h9a3 3 0 013 3v10.5a3 3 0 01-3 3h-9z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">No announcements yet</p>
          <p className="text-sm text-gray-500">Check back later for updates</p>
        </div>
      ) : (
        <ul className="space-y-3 max-h-80 overflow-y-auto">
          {[...visibleNotifications].reverse().map((note) => (
            <li
              key={note._id}
              className={`border rounded-lg p-4 flex justify-between items-start transition-all duration-300 hover:shadow-md ${
                recentIds.has(note._id) 
                  ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-300 shadow-lg' 
                  : 'bg-white border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex-1">
                <p className="text-gray-800 font-medium mb-2">{note.message}</p>
                <span className="text-sm text-gray-500">
                  {new Date(note.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => handleRead(note._id)}
                className="ml-4 bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-2 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
              >
                Mark as Read
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};


export default NotificationFeed;
