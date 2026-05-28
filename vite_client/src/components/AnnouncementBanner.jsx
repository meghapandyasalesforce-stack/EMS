import React, { useEffect, useState } from 'react';
import { FiBell } from 'react-icons/fi';
import axios from '../utils/axios';
import { BOTH_NOTIFICATION_ENDPOINT } from '../utils/constant';

const AnnouncementBanner = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('dismissedAnnouncements')) || []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${BOTH_NOTIFICATION_ENDPOINT}/user-notifications`, {
          params: { limit: 10, page: 1 },
        });
        if (cancelled) return;
        const list = (res.data?.notifications || []).filter(
          (n) => n && (n.type === 'announcement' || n.isBroadcast === true)
        );
        setAnnouncements(list);
      } catch {
        // non-fatal
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = announcements.filter((n) => !dismissed.has(String(n._id)));

  const dismiss = (id) => {
    const next = new Set(dismissed);
    next.add(String(id));
    setDismissed(next);
    localStorage.setItem('dismissedAnnouncements', JSON.stringify([...next]));
  };

  if (!visible.length) return null;

  return (
    <div className="mb-5 space-y-2">
      {visible.map((note) => (
        <div
          key={note._id}
          className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm"
        >
          <div className="flex min-w-0 items-start gap-3">
            <FiBell className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-emerald-900">{note.message}</p>
              <p className="mt-0.5 text-xs text-emerald-600">
                {new Date(note.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismiss(note._id)}
            className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
};

export default AnnouncementBanner;
