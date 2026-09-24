import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import axios from '../utils/axios';
import { toast } from 'react-toastify';
import { FaPaperclip, FaTrash, FaEdit } from 'react-icons/fa';

const authorName = (author) => {
    if (!author) return 'Unknown';
    if (typeof author === 'string') return 'Participant';
    const name = `${author.name || ''} ${author.lastName || ''}`.trim();
    return name || 'Participant';
};

const authorId = (author) => String(author?._id || author || '');

/**
 * Shared participant meeting notes thread (append-only per author).
 */
const MeetingNotesPanel = ({
    meeting,
    currentUserId,
    onMeetingUpdated,
    compact = false,
}) => {
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [editingId, setEditingId] = useState('');
    const [editContent, setEditContent] = useState('');
    const [attachments, setAttachments] = useState([]);

    const notes = useMemo(() => {
        const list = Array.isArray(meeting?.meetingNotes) ? [...meeting.meetingNotes] : [];
        // Legacy fallbacks as read-only synthetic rows
        if (list.length === 0) {
            if (meeting?.managerNotes) {
                list.push({
                    _id: 'legacy-manager',
                    author: meeting.managerId,
                    content: meeting.managerNotes,
                    createdAt: meeting.updatedAt || meeting.createdAt,
                    updatedAt: meeting.updatedAt || meeting.createdAt,
                    legacy: true,
                });
            }
            if (meeting?.employeeNotes) {
                list.push({
                    _id: 'legacy-employee',
                    author: meeting.employeeId,
                    content: meeting.employeeNotes,
                    createdAt: meeting.updatedAt || meeting.createdAt,
                    updatedAt: meeting.updatedAt || meeting.createdAt,
                    legacy: true,
                });
            }
        }
        return list.sort(
            (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        );
    }, [meeting]);

    const refreshFromResponse = (data) => {
        if (data && typeof onMeetingUpdated === 'function') onMeetingUpdated(data);
    };

    const handleAdd = async () => {
        const content = draft.trim();
        if (!content || !meeting?._id) return;
        setBusy(true);
        try {
            const res = await axios.post(
                `/v1/both/one-on-one/one-on-ones/${meeting._id}/notes`,
                { content },
                { withCredentials: true }
            );
            setDraft('');
            refreshFromResponse(res.data?.data);
            toast.success('Note added');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add note');
        } finally {
            setBusy(false);
        }
    };

    const handleUpdate = async (noteId) => {
        const content = editContent.trim();
        if (!content || !meeting?._id) return;
        setBusy(true);
        try {
            const res = await axios.patch(
                `/v1/both/one-on-one/one-on-ones/${meeting._id}/notes/${noteId}`,
                { content },
                { withCredentials: true }
            );
            setEditingId('');
            setEditContent('');
            refreshFromResponse(res.data?.data);
            toast.success('Note updated');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update note');
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (noteId) => {
        if (!meeting?._id || String(noteId).startsWith('legacy-')) return;
        setBusy(true);
        try {
            const res = await axios.delete(
                `/v1/both/one-on-one/one-on-ones/${meeting._id}/notes/${noteId}`,
                { withCredentials: true }
            );
            refreshFromResponse(res.data?.data);
            toast.success('Note deleted');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete note');
        } finally {
            setBusy(false);
        }
    };

    const onAttach = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setAttachments((prev) => [
            ...prev,
            ...files.map((f) => ({ name: f.name, size: f.size })),
        ].slice(0, 10));
        e.target.value = '';
        toast.info('Attachment linked to this meeting (local for now)');
    };

    if (!meeting) {
        return (
            <p className="text-sm text-slate-500">
                Select a meeting to view and add notes.
            </p>
        );
    }

    return (
        <div className={compact ? 'space-y-3' : 'space-y-4'}>
            <div className={`space-y-3 overflow-y-auto ${compact ? 'max-h-48' : 'max-h-72'}`}>
                {notes.length === 0 ? (
                    <p className="text-sm text-slate-500">No notes yet. Add the first note below.</p>
                ) : (
                    notes.map((note) => {
                        const mine = authorId(note.author) === String(currentUserId);
                        const created = note.createdAt ? new Date(note.createdAt) : null;
                        const updated = note.updatedAt ? new Date(note.updatedAt) : null;
                        const edited =
                            created &&
                            updated &&
                            updated.getTime() - created.getTime() > 1000;
                        const isEditing = editingId === String(note._id);

                        return (
                            <div
                                key={note._id}
                                className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5"
                            >
                                <div className="mb-1 flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">
                                            {authorName(note.author)}
                                        </p>
                                        <p className="text-[11px] text-slate-500">
                                            {created ? format(created, 'MMM d, yyyy · h:mm a') : ''}
                                            {edited
                                                ? ` · Edited ${format(updated, 'h:mm a')}`
                                                : ''}
                                        </p>
                                    </div>
                                    {mine && !note.legacy && (
                                        <div className="flex gap-1">
                                            <button
                                                type="button"
                                                title="Edit"
                                                className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                                                onClick={() => {
                                                    setEditingId(String(note._id));
                                                    setEditContent(note.content || '');
                                                }}
                                            >
                                                <FaEdit className="h-3 w-3" />
                                            </button>
                                            <button
                                                type="button"
                                                title="Delete"
                                                className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-600"
                                                onClick={() => handleDelete(note._id)}
                                                disabled={busy}
                                            >
                                                <FaTrash className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {isEditing ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            className="h-20 w-full resize-none rounded-md border border-slate-200 bg-white p-2 text-sm"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleUpdate(note._id)}
                                                disabled={busy}
                                                className="rounded-md bg-[#56B586] px-3 py-1 text-xs font-semibold text-white"
                                            >
                                                Save
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingId('');
                                                    setEditContent('');
                                                }}
                                                className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                                        {note.content}
                                    </p>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <div className="border-t border-slate-200 pt-3">
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Add a note..."
                    className="h-24 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none transition focus:border-[#56B586]/50 focus:ring-2 focus:ring-[#56B586]/15"
                />
                <div className="mt-2 flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                        <FaPaperclip />
                        Attach
                        <input type="file" className="hidden" multiple onChange={onAttach} />
                    </label>
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={busy || !draft.trim()}
                        className="ml-auto inline-flex items-center justify-center rounded-lg bg-[#56B586] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4aa578] disabled:opacity-60"
                    >
                        Add Note
                    </button>
                </div>
                {attachments.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-slate-500">
                        {attachments.map((f, i) => (
                            <li key={`${f.name}-${i}`} className="truncate">
                                {f.name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default MeetingNotesPanel;
