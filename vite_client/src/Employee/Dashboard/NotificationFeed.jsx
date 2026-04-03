import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addNotification } from '../../context/notificationSlice';
import { BOTH_NOTIFICATION_ENDPOINT } from '../../utils/constant';
import axios, { getBackendBaseURL } from '../../utils/axios';

const NotificationFeed = () => {
  const dispatch = useDispatch();
  const allNotifications = useSelector((state) => state.notifications.list || []);
  const [visibleNotifications, setVisibleNotifications] = useState([]);
  const [recentIds, setRecentIds] = useState(new Set());
 const [readIds, setReadIds] = useState(() => {
  try {
    const saved = localStorage.getItem('readNotifications');
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
});
  const readIdsRef = useRef(readIds);
  useEffect(() => {
    readIdsRef.current = readIds;
  }, [readIds]);

  // Construct SSE URL - EventSource needs full URL, not relative path
  const getSSEUrl = () => {
    const backendUrl = getBackendBaseURL();
    // SSE endpoint: /api/v1/both/notification/get-all-notification
    return `${backendUrl}/api/v1/both/notification/get-all-notification`;
  };

  // Load recent announcements via REST (org-scoped, authenticated) so history shows even if SSE misses the window
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${BOTH_NOTIFICATION_ENDPOINT}/user-notifications`, {
          params: { limit: 40, page: 1 },
        });
        const list = res.data?.notifications;
        if (cancelled || !Array.isArray(list) || !list.length) return;
        const forCard = list.filter(
          (n) => n && (n.type === 'announcement' || n.isBroadcast === true)
        );
        if (forCard.length) dispatch(addNotification(forCard));
      } catch {
        // non-fatal: SSE may still deliver broadcasts
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    const sseUrl = getSSEUrl();
    // Removed console.log for production
    
    const eventSource = new EventSource(sseUrl, {
      withCredentials: true,
    });

    // Handle connection established
    eventSource.addEventListener('connected', (event) => {
      // Removed console.log for production
    });

    // Handle errors from server
    eventSource.addEventListener('error', (event) => {
      try {
        const data = JSON.parse(event.data);
        // Removed console.error for production
      } catch (err) {
        // Removed console.error for production
      }
    });

    // Handle notification messages
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          dispatch(addNotification(data));

          const rid = readIdsRef.current;
          const isAnnouncementCard = (n) =>
            n && (n.type === 'announcement' || n.isBroadcast === true);
          const filtered = data.filter(
            (n) => isAnnouncementCard(n) && !rid.has(String(n._id))
          );

          const newIds = filtered.map((n) => n._id);
          if (newIds.length) {
            setRecentIds((prev) => new Set([...prev, ...newIds]));
            setTimeout(() => {
              setRecentIds((prev) => {
                const updated = new Set(prev);
                newIds.forEach((id) => updated.delete(id));
                return updated;
              });
            }, 3000);
          }
        }
      } catch (err) {
        // Removed console.error for production
      }
    };

    // Handle connection errors
    eventSource.onerror = (err) => {
      // Removed console.error for production
      // Don't close immediately - EventSource will auto-retry
      // Only close if it's a critical error
      if (eventSource.readyState === EventSource.CLOSED) {
        // Removed console.log for production
        eventSource.close();
      }
    };

    return () => eventSource.close();
  }, [dispatch]);

  const handleRead = (id) => {
    const sid = String(id);
    const newReadIds = new Set(readIds);
    newReadIds.add(sid);
    setReadIds(newReadIds);
    localStorage.setItem('readNotifications', JSON.stringify([...newReadIds]));
  };

  // Sync visible list from Redux + read state (broadcasts + announcement type)
  useEffect(() => {
    const freshVisible = allNotifications
      .filter(
        (n) =>
          n &&
          (n.type === 'announcement' || n.isBroadcast === true) &&
          !readIds.has(String(n._id))
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
                recentIds.has(String(note._id))
                  ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-300 shadow-lg' 
                  : 'bg-white border-gray-200 hover:border-theme-secondary'
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
                className="ml-4 bg-gradient-to-r from-green-500 to-[var(--color-primary)] text-white px-3 py-2 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
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
