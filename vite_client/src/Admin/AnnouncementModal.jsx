import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import NotificationSender from './NotificationSender';
import '../styles/announcementsUI.css';

/**
 * Centered “New Announcement” popup for dashboards only.
 * Announcements page uses the side drawer via NotificationSender directly.
 */
export default function AnnouncementModal({ onClose, onSent }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const scrollAreas = Array.from(document.querySelectorAll('.main-scroll-area'));
    const prevScroll = scrollAreas.map((el) => el.style.overflow);
    document.body.style.overflow = 'hidden';
    scrollAreas.forEach((el) => {
      el.style.overflow = 'hidden';
    });

    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])'
        ) || []
      ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');

    const first = focusables()[0];
    first?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length < 2) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevBody;
      scrollAreas.forEach((el, i) => {
        el.style.overflow = prevScroll[i] || '';
      });
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="ann-modal-root" role="presentation">
      <button
        type="button"
        className="ann-modal-backdrop"
        aria-label="Dismiss dialog"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="ann-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ann-modal__head">
          <p className="ann-modal__eyebrow">Communications</p>
          <div className="ann-modal__title-row">
            <h2 id="announcement-modal-title" className="ann-modal__title">
              New Announcement
            </h2>
            <button type="button" className="ann-modal__close" onClick={onClose} aria-label="Close">
              <FiX />
            </button>
          </div>
        </header>
        <div className="ann-modal__body">
          <NotificationSender
            open
            asDrawer={false}
            onClose={onClose}
            onSent={() => {
              onSent?.();
              onClose?.();
            }}
            onDraftSaved={() => {
              onSent?.();
              onClose?.();
            }}
          />
        </div>
        <footer className="ann-modal__foot">
          <button type="button" className="ann-modal__cancel" onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
