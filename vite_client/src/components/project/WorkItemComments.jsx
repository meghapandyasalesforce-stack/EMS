import React, { useState } from 'react';
import { FiMessageSquare, FiSend } from 'react-icons/fi';

function authorName(author) {
  if (!author) return 'Unknown';
  if (typeof author === 'string') return 'Team member';
  const name = `${author.name || ''} ${author.lastName || ''}`.trim();
  return name || author.email || 'Team member';
}

function formatCommentDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Shared comments UI for project work-plan tasks / subtasks.
 */
export default function WorkItemComments({
  comments = [],
  canComment = false,
  onSubmit,
  submitting = false,
  compact = false,
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Enter a comment');
      return;
    }
    setError('');
    const ok = await onSubmit?.(trimmed);
    if (ok !== false) {
      setText('');
    }
  };

  const sorted = [...(comments || [])].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return ta - tb;
  });

  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
        <FiMessageSquare size={14} />
        Comments ({sorted.length})
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-500 mb-2">No comments yet. Project members can start the discussion.</p>
      ) : (
        <ul className="space-y-2 mb-3 max-h-56 overflow-y-auto pr-1">
          {sorted.map((comment) => (
            <li
              key={comment._id || `${comment.createdAt}-${authorName(comment.author)}`}
              className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-gray-800">
                  {authorName(comment.author)}
                </span>
                <span className="text-[11px] text-gray-500">
                  {formatCommentDate(comment.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">
                {comment.text}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canComment ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Write a comment for the project team..."
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-theme-secondary resize-y min-h-[64px]"
            disabled={submitting}
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-theme-secondary text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            >
              <FiSend size={14} />
              {submitting ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
