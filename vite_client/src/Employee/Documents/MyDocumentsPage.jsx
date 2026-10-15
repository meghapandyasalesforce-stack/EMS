import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FaDownload,
  FaEdit,
  FaEye,
  FaFileAlt,
  FaSearch,
  FaSyncAlt,
  FaTrash,
  FaUpload,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios, { openDocumentPreview, saveDocumentDownload } from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { canEmployeeDeleteOwnDocument } from '../../utils/documentDeleteRules';

const UPLOAD_CATEGORIES = [
  { value: 'Employee', label: 'Employee' },
  { value: 'Certificate', label: 'Certificate' },
  { value: 'Contract', label: 'Contract' },
  { value: 'Legal', label: 'Legal' },
  { value: 'Other', label: 'Other' },
];

const formatBytes = (bytes) => {
  const size = Number(bytes || 0);
  if (!size) return '--';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusLabel = (doc) => {
  if (doc.approvalStatus === 'Withdrawn') return 'Withdrawn';
  if (doc.approvalStatus === 'Rejected') return 'Rejected';
  if (doc.requiresApproval && doc.approvalStatus === 'Pending') return 'Pending HR approval';
  if (doc.approvalStatus === 'Approved') return 'Approved';
  return doc.approvalStatus || 'Active';
};

const statusClass = (doc) => {
  if (doc.approvalStatus === 'Withdrawn') return 'bg-slate-100 text-slate-700';
  if (doc.approvalStatus === 'Rejected') return 'bg-red-100 text-red-700';
  if (doc.requiresApproval && doc.approvalStatus === 'Pending') return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-800';
};

const MyDocumentsPage = () => {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Employee');
  const [uploadDescription, setUploadDescription] = useState('');
  const replaceInputRef = useRef(null);
  const [replaceTargetId, setReplaceTargetId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/v1/both/documents/mine', {
        withCredentials: true,
        params: { limit: 100, search: debouncedSearch || undefined },
      });
      setDocuments(response.data?.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load your documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const filteredCount = useMemo(() => documents.length, [documents]);

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadName('');
    setUploadCategory('Employee');
    setUploadDescription('');
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!uploadFile) {
      toast.error('Please choose a file');
      return;
    }

    const formData = new FormData();
    formData.append('document', uploadFile);
    formData.append('name', uploadName.trim() || uploadFile.name);
    formData.append('category', uploadCategory);
    if (uploadDescription.trim()) {
      formData.append('description', uploadDescription.trim());
    }

    try {
      setUploading(true);
      await axios.post('/v1/both/documents/upload', formData, { withCredentials: true });
      toast.success('Document uploaded. HR will review and approve it.');
      setShowUploadModal(false);
      resetUploadForm();
      await loadDocuments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async (doc) => {
    setActionId(doc._id);
    try {
      await openDocumentPreview(doc._id, {
        scope: 'both',
        fileUrl: doc.fileUrl,
        fileName: doc.fileName || doc.name,
        mimeType: doc.mimeType,
      });
    } catch (error) {
      toast.error(error?.message || 'Could not open preview');
    } finally {
      setActionId(null);
    }
  };

  const handleDownload = async (doc) => {
    setActionId(doc._id);
    try {
      await saveDocumentDownload(doc._id, doc.fileName || doc.name || 'document', {
        scope: 'both',
        fileUrl: doc.fileUrl,
      });
    } catch (error) {
      toast.error(error?.message || 'Failed to download document');
    } finally {
      setActionId(null);
    }
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();
    if (!editDoc?._id) return;

    try {
      setActionId(editDoc._id);
      await axios.patch(
        `/v1/both/documents/${editDoc._id}`,
        {
          name: editDoc.name,
          description: editDoc.description,
          category: editDoc.category,
        },
        { withCredentials: true }
      );
      toast.success('Document updated');
      setEditDoc(null);
      await loadDocuments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update document');
    } finally {
      setActionId(null);
    }
  };

  const handleReplaceFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !replaceTargetId) return;

    const formData = new FormData();
    formData.append('document', file);

    try {
      setActionId(replaceTargetId);
      await axios.put(`/v1/both/documents/${replaceTargetId}/replace`, formData, {
        withCredentials: true,
      });
      toast.success('Document file updated');
      await loadDocuments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to replace file');
    } finally {
      setActionId(null);
      setReplaceTargetId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteDoc?._id) return;

    try {
      setActionId(deleteDoc._id);
      await axios.delete(`/v1/both/documents/${deleteDoc._id}`, { withCredentials: true });
      toast.success('Document deleted');
      setDeleteDoc(null);
      await loadDocuments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete document');
    } finally {
      setActionId(null);
    }
  };

  if (loading && documents.length === 0) {
    return <LoadingSpinner message="Loading your documents..." />;
  }

  return (
    <div className="min-h-screen bg-[#F4F6FB]">
      <input
        ref={replaceInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={handleReplaceFile}
      />

      <div className="page-shell">
      <div className="page-shell-inner">
      <div className="hrms-stack">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">My Documents</h1>
              <p className="mt-1 text-sm text-slate-600">
                Upload and manage your personal documents. Only you can access these files.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#20C997] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
            >
              <FaUpload />
              Upload document
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your documents..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#20C997]/40 focus:ring-2 focus:ring-[#20C997]/20"
              />
            </div>
            <button
              type="button"
              onClick={loadDocuments}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FaSyncAlt className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-sm text-slate-600">
              {filteredCount} document{filteredCount === 1 ? '' : 's'}
            </p>
          </div>

          {documents.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <FaFileAlt className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">No documents yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Upload PDF, Word, or image files. HR will review submissions when approval is required.
              </p>
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#20C997] px-4 py-2 text-sm font-semibold text-white"
              >
                <FaUpload />
                Upload your first document
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {documents.map((doc) => {
                const busy = actionId === doc._id;
                return (
                  <li key={doc._id} className="px-5 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-semibold text-slate-900">
                            {doc.name || doc.fileName}
                          </h2>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(doc)}`}>
                            {statusLabel(doc)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {doc.category || 'Employee'} · {formatBytes(doc.fileSize)} · Uploaded{' '}
                          {formatDate(doc.createdAt)}
                        </p>
                        {doc.description ? (
                          <p className="mt-2 text-sm text-slate-600 line-clamp-2">{doc.description}</p>
                        ) : null}
                        {doc.approvalStatus === 'Rejected' && doc.rejectionReason ? (
                          <p className="mt-2 text-sm text-red-600">Reason: {doc.rejectionReason}</p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handlePreview(doc)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <FaEye />
                          View
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDownload(doc)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <FaDownload />
                          Download
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setEditDoc({
                              _id: doc._id,
                              name: doc.name || doc.fileName || '',
                              description: doc.description || '',
                              category: doc.category || 'Employee',
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <FaEdit />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setReplaceTargetId(doc._id);
                            replaceInputRef.current?.click();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <FaSyncAlt />
                          Replace file
                        </button>
                        {canEmployeeDeleteOwnDocument(doc) ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDeleteDoc(doc)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          <FaTrash />
                          Delete
                        </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      </div>
      </div>

      {showUploadModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Upload document</h2>
            <form onSubmit={handleUpload} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">File</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setUploadFile(file || null);
                    if (file && !uploadName.trim()) setUploadName(file.name);
                  }}
                  className="w-full text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Document title"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {UPLOAD_CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description (optional)</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    resetUploadForm();
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-lg bg-[#20C997] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editDoc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Edit document</h2>
            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  required
                  value={editDoc.name}
                  onChange={(e) => setEditDoc((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
                <select
                  value={editDoc.category}
                  onChange={(e) => setEditDoc((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {UPLOAD_CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={editDoc.description}
                  onChange={(e) => setEditDoc((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditDoc(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionId === editDoc._id}
                  className="rounded-lg bg-[#20C997] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteDoc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Delete document?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Remove <strong>{deleteDoc.name || deleteDoc.fileName}</strong> from your documents? This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteDoc(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={actionId === deleteDoc._id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MyDocumentsPage;
