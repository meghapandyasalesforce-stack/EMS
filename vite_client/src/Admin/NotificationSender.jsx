import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createNotification } from '../context/notificationSlice';
import { toast } from 'react-toastify';
import { FiSend } from 'react-icons/fi';

const NotificationSender = ({ onSent }) => {
  const [message, setMessage] = useState('');
  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.notifications);

  const handleSend = () => {
    if (!message.trim()) {
      toast.warning('Please enter a message before sending');
      return;
    }
    dispatch(createNotification(message))
      .unwrap()
      .then(() => {
        toast.success('Announcement sent successfully!');
        setMessage('');
        onSent?.();
      })
      .catch((err) => {
        toast.error(`Failed to send: ${err.message}`);
      });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Send announcement</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Message is delivered to all employees in your organization.
          </p>
        </div>
      </div>

      <textarea
        rows={4}
        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-[var(--color-secondary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20"
        placeholder="Write your announcement…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-[1.25rem]">
          {error ? (
            <p className="text-sm text-red-600">
              <span className="font-medium">Error:</span> {error}
            </p>
          ) : (
            <p className="text-xs text-slate-400"></p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={status === 'loading' || !message.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {status === 'loading' ? (
            <>
              <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Sending…
            </>
          ) : (
            <>
              <FiSend className="h-4 w-4" />
              Send announcement
            </>
          )}
        </button>
      </div>
    </section>
  );
};

export default NotificationSender;
