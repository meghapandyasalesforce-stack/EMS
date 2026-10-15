import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addNotification,
  markOneNotificationRead,
} from '../../context/notificationSlice';
import { BOTH_NOTIFICATION_ENDPOINT } from '../../utils/constant';
import axios, { getBackendBaseURL } from '../../utils/axios';

const isAnnouncementCard = (n) =>
  n && (n.type === 'announcement' || n.isBroadcast === true);

const isUnread = (n) => n && n.isRead !== true && n.read !== true;

const getId = (n) => String(n?._id || n?.id || '');

const NotificationFeed = () => {
  const dispatch = useDispatch();
  const allNotifications = useSelector((state) => state.notifications.notifications || []);
  const [visibleNotifications, setVisibleNotifications] = useState([]);
  const [recentIds, setRecentIds] = useState(new Set());
  const [markingIds, setMarkingIds] = useState(new Set());

  const getSSEUrl = () => {
    const backendUrl = getBackendBaseURL();
    return `${backendUrl}/api/v1/both/notification/get-all-notification`;
  };

  // Load unread announcements so the card fills even if SSE misses them
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${BOTH_NOTIFICATION_ENDPOINT}/user-notifications`, {
          params: { limit: 40, page: 1, unreadOnly: true },
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        });
        const list = res.data?.notifications;
        if (cancelled || !Array.isArray(list) || !list.length) return;
        const forCard = list.filter(isAnnouncementCard);
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
    const eventSource = new EventSource(getSSEUrl(), {
      withCredentials: true,
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!Array.isArray(data)) return;

        const withUnreadDefaults = data.map((n) => ({
          ...n,
          isRead: n?.isRead === true || n?.read === true ? true : false,
          read: n?.isRead === true || n?.read === true ? true : false,
        }));
        dispatch(addNotification(withUnreadDefaults));

        const filtered = withUnreadDefaults.filter(
          (n) => isAnnouncementCard(n) && isUnread(n)
        );
        const newIds = filtered.map(getId).filter(Boolean);
        if (!newIds.length) return;

        setRecentIds((prev) => new Set([...prev, ...newIds]));
        setTimeout(() => {
          setRecentIds((prev) => {
            const updated = new Set(prev);
            newIds.forEach((id) => updated.delete(id));
            return updated;
          });
        }, 3000);
      } catch {
        // ignore malformed SSE payloads
      }
    };

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSource.close();
      }
    };

    return () => eventSource.close();
  }, [dispatch]);

  const handleRead = async (id) => {
    const sid = String(id);
    if (!sid || markingIds.has(sid)) return;

    setMarkingIds((prev) => new Set([...prev, sid]));
    try {
      await dispatch(markOneNotificationRead(sid)).unwrap();
    } catch {
      // keep item visible if API fails
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev);
        next.delete(sid);
        return next;
      });
    }
  };

  // Only unread announcements / broadcasts stay on the dashboard card
  useEffect(() => {
    const freshVisible = allNotifications
      .filter((n) => isAnnouncementCard(n) && isUnread(n))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setVisibleNotifications(freshVisible);
  }, [allNotifications]);

  return (
    <div className="p-6">
      {visibleNotifications.length === 0 ? (
        <div className="py-6 text-center">
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
          {visibleNotifications.map((note) => {
            const id = getId(note);
            const isMarking = markingIds.has(id);
            return (
              <li
                key={id}
                className={`border rounded-lg p-4 flex justify-between items-start transition-all duration-300 hover:shadow-md ${
                  recentIds.has(id)
                    ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-300 shadow-lg'
                    : 'bg-white border-gray-200 hover:border-theme-secondary'
                }`}
              >
                <div className="flex-1">
                  <p className="text-gray-800 font-medium mb-2">{note.message}</p>
                  <span className="text-sm text-gray-500">
                    {note.createdAt ? new Date(note.createdAt).toLocaleString() : ''}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isMarking}
                  onClick={() => handleRead(id)}
                  className="ml-4 bg-gradient-to-r from-green-500 to-[var(--color-primary)] text-white px-3 py-2 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-60"
                >
                  {isMarking ? 'Marking…' : 'Mark as Read'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default NotificationFeed;
