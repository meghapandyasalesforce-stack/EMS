import React, { useState } from 'react';
import NotificationSender from './NotificationSender';
import SentAnnouncements from './SentAnnouncements';

const SentAnnouncementsPage = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="bg-[#F3F7F5] p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Announcements</h1>
          <p className="text-sm text-slate-500">
            Broadcast messages to everyone, then track who has seen them.
          </p>
        </header>

        <NotificationSender onSent={() => setRefreshKey((k) => k + 1)} />
        <SentAnnouncements refreshKey={refreshKey} />
      </div>
    </div>
  );
};

export default SentAnnouncementsPage;
