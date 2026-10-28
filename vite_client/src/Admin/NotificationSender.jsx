import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { createNotification } from '../context/notificationSlice';
import { toast } from 'react-toastify';
import {
  FiSend,
  FiX,
  FiCalendar,
  FiInfo,
  FiUploadCloud,
  FiBold,
  FiItalic,
  FiList,
  FiLink,
  FiImage,
  FiFile,
} from 'react-icons/fi';
import { FaListOl } from 'react-icons/fa';
import '../styles/announcementsUI.css';

const TITLE_MAX = 120;
const MESSAGE_MAX = 8000;
const ATTACH_MAX_BYTES = 25 * 1024 * 1024;
const ATTACH_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/png',
  'image/jpeg',
];
const ATTACH_EXT = /\.(pdf|docx?|xlsx?|png|jpe?g)$/i;

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All Employees (Global)' },
];

const stripHtml = (html = '') =>
  String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();

const toDatetimeLocalValue = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const NotificationSender = ({
  open = true,
  onSent,
  onClose,
  onDraftSaved,
  draftToEdit = null,
  onDraftConsumed,
  asDrawer = true,
}) => {
  const [title, setTitle] = useState('');
  const [messageHtml, setMessageHtml] = useState('');
  const [audience, setAudience] = useState('all');
  const [important, setImportant] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [draftId, setDraftId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const sendingRef = useRef(false);
  const panelRef = useRef(null);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.notifications);

  const minDatetime = useMemo(() => {
    const d = new Date(Date.now() + 60_000);
    return toDatetimeLocalValue(d);
  }, []);

  const plainMessage = useMemo(() => stripHtml(messageHtml), [messageHtml]);

  useEffect(() => {
    if (!draftToEdit) return;
    setTitle(draftToEdit.metadata?.title || '');
    setMessageHtml(draftToEdit.message || '');
    setDraftId(draftToEdit._id || null);
    setAudience(draftToEdit.metadata?.audience || 'all');
    setImportant(
      draftToEdit.priority === 'high' || Boolean(draftToEdit.metadata?.important)
    );
    setScheduleAt(
      draftToEdit.broadcastStatus === 'scheduled' && draftToEdit.scheduledFor
        ? toDatetimeLocalValue(draftToEdit.scheduledFor)
        : ''
    );
    setAttachments(
      Array.isArray(draftToEdit.metadata?.attachments)
        ? draftToEdit.metadata.attachments.map((a, i) => ({
            id: `existing-${i}`,
            name: a.name || 'Attachment',
            size: a.size || 0,
            type: a.type || '',
            existing: true,
          }))
        : []
    );
    onDraftConsumed?.();
  }, [draftToEdit, onDraftConsumed]);

  useEffect(() => {
    if (!open || !asDrawer) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector('input:not([type="checkbox"]):not([type="file"]), textarea')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, asDrawer, onClose]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== messageHtml) {
      editorRef.current.innerHTML = messageHtml || '';
    }
  }, [draftId, open]); // sync when opening / loading draft only

  const resetForm = () => {
    setTitle('');
    setMessageHtml('');
    if (editorRef.current) editorRef.current.innerHTML = '';
    setAudience('all');
    setImportant(false);
    setScheduleAt('');
    setAttachments([]);
    setDraftId(null);
  };

  const emitEditor = () => {
    if (!editorRef.current) return;
    setMessageHtml(editorRef.current.innerHTML);
  };

  const runCommand = (command) => {
    document.execCommand(command, false, null);
    editorRef.current?.focus();
    emitEditor();
  };

  const insertLink = () => {
    const url = window.prompt('Enter URL');
    if (url) document.execCommand('createLink', false, url);
    editorRef.current?.focus();
    emitEditor();
  };

  const insertImage = () => {
    const url = window.prompt('Enter image URL');
    if (url) document.execCommand('insertImage', false, url);
    editorRef.current?.focus();
    emitEditor();
  };

  const acceptFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const next = [...attachments];
    for (const file of incoming) {
      const typeOk = ATTACH_TYPES.includes(file.type) || ATTACH_EXT.test(file.name);
      if (!typeOk) {
        toast.warning(`${file.name}: unsupported file type`);
        continue;
      }
      if (file.size > ATTACH_MAX_BYTES) {
        toast.warning(`${file.name}: exceeds 25MB limit`);
        continue;
      }
      next.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        file,
      });
    }
    setAttachments(next);
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const runCreate = async ({ draft }) => {
    if (sendingRef.current || status === 'loading') return;
    if (!title.trim()) {
      toast.warning('Please enter an announcement title');
      return;
    }
    if (!plainMessage) {
      toast.warning('Please enter a message body');
      return;
    }
    if (plainMessage.length > MESSAGE_MAX) {
      toast.warning(`Message must be ${MESSAGE_MAX} characters or fewer`);
      return;
    }

    let scheduleIso;
    if (!draft && scheduleAt) {
      const when = new Date(scheduleAt);
      if (Number.isNaN(when.getTime())) {
        toast.warning('Invalid schedule date/time');
        return;
      }
      if (when.getTime() <= Date.now() + 30_000) {
        toast.warning('Schedule time must be at least 1 minute from now');
        return;
      }
      scheduleIso = when.toISOString();
    }

    sendingRef.current = true;
    try {
      await dispatch(
        createNotification({
          title: title.trim().slice(0, TITLE_MAX),
          message: messageHtml.trim() || plainMessage,
          draft,
          draftId: draftId || undefined,
          scheduleAt: scheduleIso,
          priority: important ? 'high' : 'medium',
          audience,
          important,
          attachments: attachments.map(({ name, size, type }) => ({ name, size, type })),
        })
      ).unwrap();

      if (draft) {
        toast.success(draftId ? 'Draft updated' : 'Draft saved');
        resetForm();
        onDraftSaved?.();
      } else if (scheduleIso) {
        toast.success('Announcement scheduled');
        resetForm();
        onSent?.();
      } else {
        toast.success('Announcement sent successfully!');
        resetForm();
        onSent?.();
      }
    } catch (err) {
      toast.error(`Failed: ${err?.message || err || 'Request failed'}`);
    } finally {
      sendingRef.current = false;
    }
  };

  if (!open) return null;

  const heading = draftId
    ? scheduleAt
      ? 'Edit scheduled'
      : 'Edit draft'
    : 'Create announcement';

  const canSubmit = Boolean(title.trim() && plainMessage) && status !== 'loading';

  const form = (
    <div
      ref={panelRef}
      className={asDrawer ? 'ann-drawer' : 'ann-drawer ann-drawer--embedded'}
      role={asDrawer ? 'dialog' : undefined}
      aria-modal={asDrawer ? 'true' : undefined}
      aria-labelledby={asDrawer ? 'announcement-modal-title' : undefined}
      onClick={asDrawer ? (e) => e.stopPropagation() : undefined}
    >
      {asDrawer ? (
        <div className="ann-drawer__head">
          <h2 id="announcement-modal-title" className="ann-drawer__title">{heading}</h2>
          {onClose ? (
            <button type="button" className="ann-drawer__close" onClick={onClose} aria-label="Close">
              <FiX />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="ann-drawer__body">
        <div className="ann-drawer__field">
          <div className="ann-drawer__label-row">
            <span className="ann-drawer__label">
              Announcement Title <span className="ann-drawer__req">*</span>
            </span>
            <span className="ann-drawer__hint">Max {TITLE_MAX} characters</span>
          </div>
          <input
            type="text"
            className="ann-drawer__input ann-drawer__input--soft"
            placeholder="e.g. Annual Benefits Enrollment & Open Forum"
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="ann-drawer__split">
          <label className="ann-drawer__field">
            <span className="ann-drawer__label">
              Target Audience <span className="ann-drawer__req">*</span>
            </span>
            <select
              className="ann-drawer__select ann-drawer__select--plain"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              {AUDIENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div className="ann-drawer__field">
            <span className="ann-drawer__label">Priority</span>
            <div className="ann-drawer__priority" role="group" aria-label="Priority">
              <button
                type="button"
                className={`ann-drawer__priority-btn${!important ? ' is-active' : ''}`}
                aria-pressed={!important}
                onClick={() => setImportant(false)}
              >
                Normal
              </button>
              <button
                type="button"
                className={`ann-drawer__priority-btn${important ? ' is-active is-important' : ''}`}
                aria-pressed={important}
                onClick={() => setImportant(true)}
              >
                Important
              </button>
            </div>
          </div>
        </div>

        <div className="ann-drawer__field">
          <span className="ann-drawer__label">
            Message Body <span className="ann-drawer__req">*</span>
          </span>
          <div className="ann-drawer__editor">
            <div className="ann-drawer__toolbar" role="toolbar" aria-label="Formatting">
              <button type="button" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('bold')}>
                <FiBold />
              </button>
              <button type="button" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('italic')}>
                <FiItalic />
              </button>
              <button type="button" title="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('insertUnorderedList')}>
                <FiList />
              </button>
              <button type="button" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('insertOrderedList')}>
                <FaListOl />
              </button>
              <span className="ann-drawer__toolbar-sep" aria-hidden="true" />
              <button type="button" title="Insert link" onMouseDown={(e) => e.preventDefault()} onClick={insertLink}>
                <FiLink />
              </button>
              <button type="button" title="Insert image" onMouseDown={(e) => e.preventDefault()} onClick={insertImage}>
                <FiImage />
              </button>
            </div>
            <div
              ref={editorRef}
              className="ann-drawer__editor-surface"
              contentEditable
              role="textbox"
              aria-multiline="true"
              aria-label="Message body"
              data-placeholder="Write your announcement content here using Markdown or rich text formatting..."
              onInput={emitEditor}
              onBlur={emitEditor}
            />
          </div>
        </div>

        <div className="ann-drawer__field">
          <span className="ann-drawer__label">Attachments &amp; Documents</span>
          <div
            className={`ann-drawer__dropzone${dragOver ? ' is-dragover' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              acceptFiles(e.dataTransfer.files);
            }}
          >
            <FiUploadCloud className="ann-drawer__drop-ico" aria-hidden="true" />
            <p className="ann-drawer__drop-text">
              Drag &amp; drop files here, or{' '}
              <button
                type="button"
                className="ann-drawer__browse"
                onClick={() => fileInputRef.current?.click()}
              >
                browse
              </button>
            </p>
            <p className="ann-drawer__drop-hint">Supports PDF, DOCX, XLSX, PNG, JPG up to 25MB</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="ann-drawer__file-input"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => {
                acceptFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
          {attachments.length > 0 ? (
            <ul className="ann-drawer__attach-list">
              {attachments.map((file) => (
                <li key={file.id}>
                  <FiFile aria-hidden="true" />
                  <span className="ann-drawer__attach-name">{file.name}</span>
                  <span className="ann-drawer__attach-size">{formatFileSize(file.size)}</span>
                  <button type="button" onClick={() => removeAttachment(file.id)} aria-label={`Remove ${file.name}`}>
                    <FiX />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="ann-drawer__field">
          <span className="ann-drawer__label">Schedule Delivery (Optional)</span>
          <div className="ann-drawer__schedule-row">
            <div className="ann-drawer__datetime">
              <input
                type="datetime-local"
                className="ann-drawer__input ann-drawer__input--soft"
                min={minDatetime}
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                aria-label="Schedule delivery"
              />
              <FiCalendar className="ann-drawer__datetime-ico" aria-hidden="true" />
            </div>
            <p className="ann-drawer__schedule-help">
              <FiInfo aria-hidden="true" />
              Leave blank to publish immediately upon clicking Send.
            </p>
          </div>
        </div>

        {error ? <p className="ann-drawer__error">{error}</p> : null}
      </div>

      <div className="ann-drawer__footer">
        <button
          type="button"
          className="ann-drawer__btn ann-drawer__btn--secondary"
          disabled={!canSubmit}
          onClick={() => runCreate({ draft: true })}
        >
          Save draft
        </button>
        <button
          type="button"
          className="ann-drawer__btn ann-drawer__btn--primary"
          disabled={!canSubmit}
          onClick={() => runCreate({ draft: false })}
        >
          <FiSend className="h-4 w-4" />
          {status === 'loading'
            ? 'Working…'
            : scheduleAt
              ? 'Schedule announcement'
              : 'Send announcement'}
        </button>
      </div>
    </div>
  );

  if (!asDrawer) return form;

  return createPortal(
    <div className="ann-drawer-root" role="presentation">
      <button
        type="button"
        className="ann-drawer-backdrop"
        aria-label="Dismiss drawer"
        onClick={onClose}
      />
      <div className="ann-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {form}
      </div>
    </div>,
    document.body
  );
};

export default NotificationSender;
