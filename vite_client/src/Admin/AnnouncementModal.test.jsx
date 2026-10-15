import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AnnouncementModal from './AnnouncementModal';

vi.mock('./NotificationSender', () => ({
  default: ({ onClose, onSent }) => <section>
    <h2 id="announcement-modal-title">Send announcement</h2>
    <textarea aria-label="Announcement" />
    <button onClick={onClose}>Close announcement</button>
    <button onClick={onSent}>Send announcement</button>
  </section>
}));

afterEach(cleanup);

describe('AnnouncementModal', () => {
  it('portals outside the dashboard, locks scrolling, and restores focus and scrolling on close', () => {
    const dashboard = document.createElement('main');
    dashboard.className = 'main-scroll-area';
    dashboard.style.overflow = 'auto';
    document.body.appendChild(dashboard);
    const opener = document.createElement('button');
    dashboard.appendChild(opener);
    opener.focus();
    const close = vi.fn();
    const { unmount } = render(<AnnouncementModal onClose={close} onSent={vi.fn()} />, { container: dashboard });
    const dialog = screen.getByRole('dialog');
    expect(dashboard.contains(dialog)).toBe(false);
    expect(document.body.style.overflow).toBe('hidden');
    expect(dashboard.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
    unmount();
    expect(dashboard.style.overflow).toBe('auto');
    dashboard.remove();
  });

  it('keeps form clicks inside, supports close and send, and traps keyboard focus', () => {
    const close = vi.fn();
    const sent = vi.fn();
    render(<AnnouncementModal onClose={close} onSent={sent} />);
    fireEvent.click(screen.getByRole('textbox'));
    expect(close).not.toHaveBeenCalled();
    const send = screen.getByRole('button', { name: 'Send announcement' });
    send.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
    fireEvent.click(send);
    expect(sent).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Close announcement' }));
    expect(close).toHaveBeenCalledOnce();
  });
});
