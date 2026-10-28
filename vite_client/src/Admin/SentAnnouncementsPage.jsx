import React, { useCallback, useState } from 'react';
import { FiPlus, FiSpeaker, FiCheckCircle, FiClock, FiFileText } from 'react-icons/fi';
import NotificationSender from './NotificationSender';
import SentAnnouncements from './SentAnnouncements';
import '../styles/announcementsUI.css';

const SentAnnouncementsPage = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftToEdit, setDraftToEdit] = useState(null);
  const [counts, setCounts] = useState({ sent: 0, drafts: 0, scheduled: 0, total: 0 });

  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  const openComposer = useCallback((draft = null) => {
    setDraftToEdit(draft);
    setComposerOpen(true);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setDraftToEdit(null);
  }, []);

  return (
    <div className="ann-ui">
      <div className="ann-ui__inner">
        <header className="ann-ui__header">
          <div>
            <p className="ann-ui__eyebrow">Communications</p>
            <h1 className="ann-ui__title">Announcements</h1>
            <p className="ann-ui__subtitle">
              Broadcast messages to everyone, then track who has seen them. Save drafts when you are not ready to send.
            </p>
          </div>
          <button
            type="button"
            className="ann-ui__btn ann-ui__btn--primary"
            onClick={() => openComposer(null)}
          >
            <FiPlus className="h-4 w-4" /> New announcement
          </button>
        </header>

        <div className="ann-ui__kpis">
          <div className="ann-ui__kpi">
            <p className="ann-ui__kpi-label">Total</p>
            <span className="ann-ui__kpi-icon"><FiSpeaker /></span>
            <p className="ann-ui__kpi-value">{counts.total}</p>
            <p className="ann-ui__kpi-meta">All announcements</p>
          </div>
          <div className="ann-ui__kpi">
            <p className="ann-ui__kpi-label">Sent</p>
            <span className="ann-ui__kpi-icon"><FiCheckCircle /></span>
            <p className="ann-ui__kpi-value">{counts.sent}</p>
            <p className="ann-ui__kpi-meta">Delivered to employees</p>
          </div>
          <div className="ann-ui__kpi">
            <p className="ann-ui__kpi-label">Scheduled</p>
            <span className="ann-ui__kpi-icon"><FiClock /></span>
            <p className="ann-ui__kpi-value">{counts.scheduled || 0}</p>
            <p className="ann-ui__kpi-meta">Waiting to send</p>
          </div>
          <div className="ann-ui__kpi">
            <p className="ann-ui__kpi-label">Drafts</p>
            <span className="ann-ui__kpi-icon"><FiFileText /></span>
            <p className="ann-ui__kpi-value">{counts.drafts}</p>
            <p className="ann-ui__kpi-meta">Not ready yet</p>
          </div>
        </div>

        <SentAnnouncements
          refreshKey={refreshKey}
          onCountsChange={setCounts}
          onEditDraft={(row) => openComposer(row)}
          onNew={() => openComposer(null)}
        />
      </div>

      <NotificationSender
        open={composerOpen}
        asDrawer
        draftToEdit={draftToEdit}
        onDraftConsumed={() => setDraftToEdit(null)}
        onSent={() => {
          bump();
          closeComposer();
        }}
        onDraftSaved={() => {
          bump();
          closeComposer();
        }}
        onClose={closeComposer}
      />
    </div>
  );
};

export default SentAnnouncementsPage;
