import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import { BOTH_CELEBRATION_ENDPOINT } from '../utils/constant';
import ProfilePicture from '../Shared/ProfilePicture';
import { toast } from 'react-toastify';

const REACTIONS = ['❤️', '🎉', '👏', '🥳'];

function formatWishTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ReactionBar({ reactionCounts, myReactions = [], onReact, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {REACTIONS.map((emoji) => {
        const count = reactionCounts?.[emoji] || 0;
        const mine = myReactions.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            disabled={disabled}
            onClick={() => onReact(emoji)}
            className={`inline-flex min-w-[4.5rem] items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-lg shadow-sm transition disabled:opacity-50 ${
              mine
                ? 'border-emerald-400 bg-white ring-2 ring-emerald-200'
                : 'border-white/70 bg-white/90 hover:border-emerald-300 hover:bg-white'
            }`}
            aria-pressed={mine}
          >
            <span>{emoji}</span>
            <span className="text-sm font-semibold text-slate-700">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function WishForm({ onSubmit, submitting, eventType = 'birthday' }) {
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    await onSubmit(comment.trim());
    setComment('');
    setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-6 text-center">
        <p className="text-2xl">💌</p>
        <p className="mt-2 font-semibold text-emerald-800">Wish sent privately</p>
        <p className="mt-1 text-sm text-emerald-700">Only they can read this message.</p>
      </div>
    );
  }

  const placeholder = eventType === 'marriage_anniversary'
    ? "Happy Marriage Anniversary! Wishing you both a wonderful journey together."
    : eventType === 'anniversary'
      ? "Congratulations on your work anniversary! Wishing you continued success."
      : "Happy Birthday! Hope you have a wonderful year ahead.";

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Send a private wish</h3>
      <p className="mt-1 text-sm text-slate-500">This stays between you and them. The rest of the team will not be notified.</p>
      <textarea
        id="celebration-wish"
        rows={4}
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={placeholder}
        className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">{comment.length}/500</p>
        <button
          type="submit"
          disabled={submitting || !comment.trim()}
          className="rounded-full bg-[#20C997] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1ab589] disabled:opacity-50"
        >
          {submitting ? 'Sending...' : 'Send Wish'}
        </button>
      </div>
    </form>
  );
}

function CelebrationCard({ event, onReact, onWish, onDelete, actionLoading }) {
  const isMarriage = event.type === 'marriage_anniversary';
  const isWorkAnniversary = event.type === 'anniversary';
  const isBirthday = !isMarriage && !isWorkAnniversary;

  const name = event.employee?.name || 'Employee';
  const reactionTotal = Object.values(event.reactionCounts || {}).reduce((sum, n) => sum + n, 0);
  const wishCount = event.wishes?.length || 0;
  const peopleCount = (event.reactors || []).length;

  const groupedReactions = useMemo(() => (
    REACTIONS.map((emoji) => ({
      emoji,
      count: event.reactionCounts?.[emoji] || 0,
      people: (event.reactions || [])
        .filter((r) => r.emoji === emoji)
        .map((r) => r.employeeName)
        .filter(Boolean),
    })).filter((row) => row.count > 0)
  ), [event.reactionCounts, event.reactions]);

  const title = event.isSubject
    ? (isMarriage ? 'Happy Marriage Anniversary!' : isWorkAnniversary ? 'Happy Work Anniversary!' : 'Happy Birthday!')
    : (isMarriage ? `${name}'s Marriage Anniversary` : isWorkAnniversary ? `${name}'s Work Anniversary` : `${name}'s Birthday`);

  const categoryTag = event.isSubject
    ? (isMarriage ? 'Your marriage anniversary' : isWorkAnniversary ? 'Your work anniversary' : "It's your birthday")
    : (isMarriage ? 'Marriage anniversary' : isWorkAnniversary ? 'Work anniversary' : 'Birthday celebration');

  const celebrationIcon = isMarriage ? '💍 ' : isWorkAnniversary ? '🎉 ' : '🎂 ';

  return (
    <article className="overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-lg shadow-amber-100/60">
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-200 via-rose-100 to-emerald-100 px-6 py-8 sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute inset-0 text-3xl opacity-30 sm:text-4xl">
          <span className="absolute left-6 top-4">🎈</span>
          <span className="absolute right-10 top-6">✨</span>
          <span className="absolute bottom-5 left-16">🎁</span>
          <span className="absolute bottom-8 right-8">🎊</span>
        </div>
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:gap-5 sm:text-left">
            <div className="shrink-0 rounded-full bg-white p-1 shadow-md">
              <ProfilePicture user={event.employee} size="xl" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700 sm:text-xs sm:tracking-[0.18em]">
                {categoryTag}
              </p>
              <h2 className="mt-1 break-words text-2xl font-bold leading-tight text-slate-900 sm:text-4xl">
                {celebrationIcon}{title}
              </h2>
              <p className="mt-2 text-xs text-slate-600 sm:text-sm">
                {event.employee?.department || 'Team'}
                {isMarriage && event.completedYears
                  ? ` · ${event.completedYears} year${event.completedYears === 1 ? '' : 's'} of marriage`
                  : ''}
                {isWorkAnniversary && event.completedYears
                  ? ` · ${event.completedYears} year${event.completedYears === 1 ? '' : 's'} with us`
                  : ''}
              </p>
            </div>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-[280px] sm:gap-3">
            {[
              { label: 'Reactions', value: reactionTotal },
              { label: 'People', value: peopleCount },
              { label: event.isSubject ? 'Wishes' : 'Private', value: event.isSubject ? wishCount : 'Wish' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-white/80 px-2 py-3 text-center shadow-sm sm:px-3">
                <p className="text-lg font-bold text-slate-900 sm:text-xl">{stat.value}</p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-[11px]">{stat.label}</p>
              </div>
            ))}
          </div>
          {event.isSubject && onDelete ? (
            <div className="mt-3 flex justify-end sm:col-span-3">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => onDelete(event)}
                className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
        <div className="relative mt-6 sm:mt-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            {event.isSubject ? 'Reactions from your team' : 'Send a reaction'}
          </p>
          <ReactionBar
            reactionCounts={event.reactionCounts}
            myReactions={event.myReactions}
            onReact={(emoji) => onReact(event._id, emoji)}
            disabled={actionLoading}
          />
        </div>
      </div>

      <div className="grid gap-6 bg-slate-50 p-5 sm:p-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Who reacted</h3>
          {groupedReactions.length > 0 ? (
            <div className="mt-4 space-y-4">
              {groupedReactions.map((row) => (
                <div key={row.emoji} className="rounded-xl bg-slate-50 px-4 py-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xl">{row.emoji}</span>
                    <span className="text-sm font-semibold text-slate-600">{row.count}</span>
                  </div>
                  <p className="text-sm text-slate-600">{row.people.join(', ') || 'Team members'}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
              <p className="text-3xl">🥳</p>
              <p className="mt-2 text-sm text-slate-500">No reactions yet. Tap an emoji above.</p>
            </div>
          )}
        </section>

        {event.isSubject ? (
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Wishes for you</h3>
            <p className="mt-1 text-sm text-slate-500">Private messages — only you can see these.</p>
            {event.wishes?.length > 0 ? (
              <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                {event.wishes.map((wish) => (
                  <div key={wish._id} className="rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 px-4 py-4">
                    <p className="text-base leading-relaxed text-slate-800">“{wish.comment}”</p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{wish.commenterName}</span>
                      <span>{formatWishTime(wish.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 px-4 py-12 text-center">
                <p className="text-4xl">💌</p>
                <p className="mt-3 font-medium text-slate-700">No wishes yet</p>
                <p className="mt-1 text-sm text-slate-500">When teammates send a private wish, it will appear here.</p>
              </div>
            )}
          </section>
        ) : (
          <WishForm
            eventType={event.type}
            submitting={actionLoading}
            onSubmit={(comment) => onWish(event._id, comment)}
          />
        )}
      </div>
    </article>
  );
}

export default function CelebrationEventPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadEvents = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError('');
    }
    try {
      if (eventId) {
        const { data } = await axios.get(`${BOTH_CELEBRATION_ENDPOINT}/events/${eventId}`);
        setEvents(data?.data ? [data.data] : []);
      } else {
        const { data } = await axios.get(`${BOTH_CELEBRATION_ENDPOINT}/events`);
        setEvents(data?.data || []);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load celebrations');
      setEvents([]);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleReact = async (id, emoji) => {
    setActionLoading(true);
    try {
      await axios.post(`${BOTH_CELEBRATION_ENDPOINT}/events/${id}/react`, { emoji });
      await loadEvents(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to react');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWish = async (id, comment) => {
    setActionLoading(true);
    try {
      await axios.post(`${BOTH_CELEBRATION_ENDPOINT}/events/${id}/wish`, { comment });
      toast.success('Wish sent privately');
      setError('');
      await loadEvents(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send wish');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };


  const handleDelete = async (event) => {
    if (!event?._id) return;
    const confirmed = window.confirm('Delete this celebration?');
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await axios.delete(`${BOTH_CELEBRATION_ENDPOINT}/events/${event._id}`);
      toast.success('Celebration deleted');
      setEvents((prev) => prev.filter((item) => item._id !== event._id));
      if (eventId) {
        navigate('/celebrations');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete celebration');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-amber-50 via-rose-50/40 to-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Team celebrations</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Celebrations</h1>
            <p className="mt-1 text-sm text-slate-500">Birthdays, work anniversaries, and marriage anniversaries</p>
          </div>
          {!eventId ? (
            <Link to="/dashboard" className="text-sm font-semibold text-emerald-700 hover:underline">
              Back to dashboard
            </Link>
          ) : (
            <Link to="/celebrations" className="text-sm font-semibold text-emerald-700 hover:underline">
              All celebrations
            </Link>
          )}
        </div>

        {loading ? (
          <p className="text-slate-500">Loading celebrations...</p>
        ) : error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : events.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-amber-200 bg-white px-6 py-20 text-center">
            <p className="text-5xl">🎂</p>
            <p className="mt-4 text-lg font-semibold text-slate-800">No active celebrations right now</p>
            <p className="mt-1 text-sm text-slate-500">When someone has a birthday or work anniversary, it will show here.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {events.map((event) => (
              <CelebrationCard
                key={event._id}
                event={event}
                onReact={handleReact}
                onWish={handleWish}
                onDelete={handleDelete}
                actionLoading={actionLoading}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
