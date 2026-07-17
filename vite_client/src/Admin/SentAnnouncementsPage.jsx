import React, { useState } from 'react';
import NotificationSender from './NotificationSender';
import SentAnnouncements from './SentAnnouncements';

const SentAnnouncementsPage = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-[#F3F7F5] p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
        <NotificationSender onSent={() => setRefreshKey((k) => k + 1)} />
        <SentAnnouncements refreshKey={refreshKey} />
      </div>
    </div>
  );
};

export default SentAnnouncementsPage;
