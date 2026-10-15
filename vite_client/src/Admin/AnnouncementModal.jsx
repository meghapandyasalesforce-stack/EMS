import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import NotificationSender from './NotificationSender';

export default function AnnouncementModal({ onClose, onSent }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const scrollContainers = [document.body, document.querySelector('.main-scroll-area')].filter(Boolean);
    const previousOverflow = scrollContainers.map((element) => element.style.overflow);
    scrollContainers.forEach((element) => { element.style.overflow = 'hidden'; });
    dialogRef.current?.querySelector('textarea')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), textarea, input, select, [tabindex="0"]')];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      scrollContainers.forEach((element, index) => { element.style.overflow = previousOverflow[index]; });
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="announcement-modal-title" aria-describedby="announcement-modal-description" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <NotificationSender onClose={onClose} onSent={onSent} />
      </div>
    </div>,
    document.body
  );
}
