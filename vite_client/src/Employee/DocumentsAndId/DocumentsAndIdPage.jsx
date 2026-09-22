import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  FaSearch,
  FaDownload,
  FaShareAlt,
  FaExclamationTriangle,
  FaEye,
  FaShieldAlt,
  FaClock,
  FaClipboardList,
  FaHeadset,
  FaUpload,
  FaTrash,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios, { getUploadUrl, openDocumentPreview, saveDocumentDownload } from '../../utils/axios';
import { downloadPdfBlob } from '../../utils/downloadPdfBlob';
import LoadingSpinner from '../../components/LoadingSpinner';
import PaarsivIdCard from '../../components/PaarsivIdCard';
import { canEmployeeDeleteOwnDocument } from '../../utils/documentDeleteRules';
import { useSignedProfilePhoto } from '../../Hooks/useSignedProfilePhoto';

const formatBytes = (bytes) => {
  const size = Number(bytes || 0);
  if (!size) return '--';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const mergeDocumentsById = (lists) => {
  const map = new Map();
  lists.flat().forEach((doc) => {
    if (doc?._id) map.set(String(doc._id), doc);
  });
  return Array.from(map.values());
};

const DocumentsAndIdPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnToOnboarding = searchParams.get('returnTo') || '';
  const user = useSelector((state) => state.auth.user);
  const employee = useSelector((state) => state.employeeDetails.employee);
  const myEmployeeId = String(employee?._id || employee?.id || user?._id || user?.id || '');

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [idCard, setIdCard] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const uploadInputRef = useRef(null);
  const companyDocsRef = useRef(null);

  const cardEmployeeId = idCard?.employeeId?._id || null;
  const { photoUrl: idCardProfilePhoto } = useSignedProfilePhoto(
    idCard?.employeeId?.profilePhoto || idCard?.employeeId?.profilePicture,
    { userType: 'employee', userId: cardEmployeeId }
  );

  const loadPageData = useCallback(async () => {
    try {
      setLoading(true);
      const [documentsResp, sharedResp, idCardResp] = await Promise.allSettled([
        axios.get('/v1/both/documents', { withCredentials: true, params: { limit: 100 } }),
        axios.get('/v1/both/documents/shared', { withCredentials: true, params: { limit: 100 } }),
        axios.get('/v1/admin/id-cards/employee/my-card', { withCredentials: true })
      ]);

      const ownDocs = documentsResp.status === 'fulfilled'
        ? (documentsResp.value?.data?.data || [])
        : [];
      const sharedDocs = sharedResp.status === 'fulfilled'
        ? (sharedResp.value?.data?.data || [])
        : [];

      if (documentsResp.status === 'rejected' && sharedResp.status === 'rejected') {
        toast.error('Failed to load documents');
      }

      setDocuments(mergeDocumentsById([ownDocs, sharedDocs]));

      if (idCardResp.status === 'fulfilled') {
        setIdCard(idCardResp.value?.data?.idCard || null);
      } else {
        setIdCard(null);
      }
    } catch {
      toast.error('Failed to load documents and ID card');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const isOwnDocument = useCallback((doc) => {
    const uploaderId = String(doc?.uploadedBy?._id || doc?.uploadedBy || '');
    return myEmployeeId && uploaderId === myEmployeeId;
  }, [myEmployeeId]);

  const isHrSharedDocument = useCallback((doc) => {
    if (isOwnDocument(doc)) return false;
    if (doc.requiresApproval === false) {
      return doc.approvalStatus === 'Approved' || doc.approvalStatus == null;
    }
    return ['Policy', 'Company', 'Training', 'Compliance'].includes(doc?.category)
      && (doc.approvalStatus === 'Approved' || !doc.requiresApproval);
  }, [isOwnDocument]);

  const isHrPolicyDocument = isHrSharedDocument;

  const myUploadedDocs = useMemo(() => {
    return (documents || [])
      .filter((doc) => isOwnDocument(doc))
      // Hide superseded/replaced files; keep Rejected so status is still visible
      .filter((doc) => doc.isActive !== false || doc.approvalStatus === 'Rejected')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [documents, isOwnDocument]);

  const policyDocs = useMemo(() => {
    return (documents || [])
      .filter((doc) => isHrSharedDocument(doc))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }, [documents, isHrSharedDocument]);

  const recentlyUpdatedDocs = useMemo(() => {
    return [...myUploadedDocs, ...policyDocs]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 4);
  }, [myUploadedDocs, policyDocs]);

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
    if (doc.requiresApproval && doc.approvalStatus === 'Pending') return 'bg-yellow-100 text-yellow-700';
    return 'bg-[#20C997]/15 text-[#0a8f6c]';
  };

  const handlePreviewDocument = async (doc) => {
    try {
      await openDocumentPreview(doc._id, {
        scope: 'both',
        fileUrl: doc.fileUrl,
        fileName: doc.fileName || doc.name,
        mimeType: doc.mimeType,
      });
    } catch (error) {
      toast.error(error?.message || 'Could not open document preview');
    }
  };

  const handleDownloadDocument = async (doc) => {
    try {
      await saveDocumentDownload(doc._id, doc.fileName || doc.name || 'document', {
        scope: 'both',
        fileUrl: doc.fileUrl,
      });
    } catch (error) {
      toast.error(error?.message || 'Failed to download document');
    }
  };

  const handleDownloadIdCard = async () => {
    if (!idCard?._id) {
      toast.warning('No ID card found for your profile');
      return;
    }

    try {
      toast.info('Preparing ID card PDF…');
      const response = await axios.get(`/v1/admin/id-cards/card/${idCard._id}/download`, {
        responseType: 'blob',
        withCredentials: true
      });
      const contentType = response.headers?.['content-type'] || '';
      if (contentType && !contentType.includes('application/pdf') && contentType.includes('json')) {
        const errorText = await response.data.text();
        let message = 'Failed to download ID card PDF';
        try {
          message = JSON.parse(errorText)?.message || message;
        } catch {
          /* keep default */
        }
        toast.error(message);
        return;
      }
      const fileName = `id-card-${idCard.employeeId?.employeeId || idCard.cardNumber || 'card'}.pdf`;
      const method = await downloadPdfBlob(response.data, fileName);
      if (method === 'share-cancelled') return;
      if (method === 'open') {
        toast.success('ID card opened — use Share/Save in the browser to keep a copy');
      } else if (method === 'share') {
        toast.success('ID card ready to save or share');
      } else {
        toast.success('ID card PDF downloaded');
      }
    } catch {
      toast.error('Failed to download ID card PDF');
    }
  };

  const handleEmployeeUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const formData = new FormData();
    formData.append('document', file);
    formData.append('name', file.name);
    formData.append('category', 'Employee');

    try {
      setUploading(true);
      await axios.post('/v1/both/documents/upload', formData, { withCredentials: true });
      toast.success('Document uploaded. HR will review and approve it.');
      await loadPageData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleShareCard = async () => {
    const shareText = `${idCard?.employeeId?.name || ''} ${idCard?.employeeId?.lastName || ''} - Employee ID`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Digital ID Card', text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText.trim() || 'Digital ID Card');
      }
      toast.success('Digital ID card shared');
    } catch {
      toast.info('Share cancelled');
    }
  };

  const handleDeleteDocument = async () => {
    if (!deleteDoc?._id) return;
    try {
      setDeleting(true);
      await axios.delete(`/v1/both/documents/${deleteDoc._id}`, { withCredentials: true });
      toast.success('Document deleted successfully');
      setDeleteDoc(null);
      await loadPageData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading documents & ID card..." />;
  }

  return (
    <div className="page-shell min-h-screen bg-[#F4F6FB] transition-all duration-300">
      <div className="page-shell-inner hrms-stack">
        {returnToOnboarding && (
          <div className="cm-onboarding-return-banner">
            <span>
              Upload your onboarding documents here. When you are done, return to onboarding to view status and open files.
            </span>
            <button
              type="button"
              className="rounded-lg bg-[#006c51] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005a44]"
              onClick={() => navigate(returnToOnboarding)}
            >
              Back to onboarding
            </button>
          </div>
        )}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">Personal Documents</h1>
              <p className="mt-1 text-sm text-slate-600 sm:text-base">Manage your identity files and secure records in one place.</p>
            </div>
            <div className="relative w-full lg:max-w-sm lg:shrink-0">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#20C997]/40 focus:ring-2 focus:ring-[#20C997]/20"
              />
            </div>
          </div>
        </div>

        <div className="hrms-main-rail">
          <div className="min-w-0 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <span className="inline-flex rounded-full bg-[#20C997]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#0a8f6c]">
                  Company Identity
                </span>
                <h2 className="mt-2 text-3xl font-semibold text-slate-900">Digital Employee ID</h2>
                {idCard ? (
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center gap-3">
                      {idCardProfilePhoto ? (
                        <img
                          src={idCardProfilePhoto}
                          alt="Employee"
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg bg-slate-200" />
                      )}
                      <div>
                        <p className="font-semibold text-slate-900">
                          {idCard.employeeId?.name} {idCard.employeeId?.lastName}
                        </p>
                        <p className="text-sm text-slate-500">{idCard.employeeId?.employeeId || '--'}</p>
                        <p className="text-xs text-slate-400">{idCard.employeeId?.department || '--'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Valid until</span>
                      <span className="font-semibold text-slate-700">
                        {idCard.expiresAt ? new Date(idCard.expiresAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No ID card found. Please contact HR/admin.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-slate-900">Recently Updated</h2>
                  <button
                    type="button"
                    onClick={() => companyDocsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="text-sm font-semibold text-[#0a8f6c] hover:text-[#086d56]"
                  >
                    View Company Docs
                  </button>
                </div>
                {recentlyUpdatedDocs.length === 0 ? (
                  <p className="text-sm text-slate-500">No documents available.</p>
                ) : (
                  <div className="space-y-3">
                    {recentlyUpdatedDocs.map((doc) => (
                      <div key={doc._id} className="rounded-xl border border-slate-100 p-3">
                        <p className="truncate font-semibold text-slate-800">{doc.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatBytes(doc.fileSize)} • Updated {new Date(doc.updatedAt || doc.createdAt).toLocaleDateString()}
                        </p>
                        <div className="mt-3 flex gap-1 justify-end">
                          <button type="button" onClick={() => handlePreviewDocument(doc)} title="Preview" className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-[#0a8f6c] transition">
                            <FaEye className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleDownloadDocument(doc)} title="Download" className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-[#0a8f6c] transition">
                            <FaDownload className="w-4 h-4" />
                          </button>
                          {isOwnDocument(doc) && canEmployeeDeleteOwnDocument(doc) && (
                            <button type="button" onClick={() => setDeleteDoc(doc)} title="Delete" className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition">
                              <FaTrash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center shadow-sm">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#20C997]/15 text-[#0a8f6c]">
                <FaUpload />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Upload New Document</h3>
              <p className="mt-1 text-sm text-slate-500">Drag & drop or click to browse (PDF, PNG, JPG up to 10MB)</p>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                className="hidden"
                onChange={handleEmployeeUpload}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => uploadInputRef.current?.click()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#20C997] to-[#0a8f6c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {uploading ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </div>

          <div className="w-full space-y-4 xl:sticky xl:top-6 xl:self-start">
            <div className="w-full rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-slate-800">Digital ID Card</h2>
              {idCard ? (
                <div className="flex justify-center rounded-2xl bg-slate-50 px-4 py-6">
                  <PaarsivIdCard
                    size="preview"
                    name={idCard.employeeId?.name}
                    lastName={idCard.employeeId?.lastName}
                    jobTitle={idCard.employeeId?.jobTitle || idCard.employeeId?.position || 'Employee'}
                    employeeId={idCard.employeeId?.employeeId}
                    cardNumber={idCard.cardNumber}
                    photoUrl={idCardProfilePhoto}
                    profilePhoto={idCard.employeeId?.profilePhoto || idCard.employeeId?.profilePicture}
                    userId={idCard.employeeId?._id || idCard.employeeId?.id}
                  />
                </div>
              ) : (
                <div className="rounded-lg border p-4 text-sm text-slate-600">
                  No ID card found. Please contact HR/admin.
                </div>
              )}
            </div>

            <button
              onClick={handleDownloadIdCard}
              className="flex w-full items-center gap-2 rounded-xl border bg-white p-3 text-left transition hover:bg-gray-50"
            >
              <FaDownload className="text-slate-600" />
              <span className="font-medium text-slate-800">Download ID PDF</span>
            </button>

            <button
              onClick={handleShareCard}
              className="flex w-full items-center gap-2 rounded-xl border bg-white p-3 text-left transition hover:bg-gray-50"
            >
              <FaShareAlt className="text-slate-600" />
              <span className="font-medium text-slate-800">Share Digital Card</span>
            </button>

            <button
              onClick={() => toast.info('Lost card reporting will be enabled soon.')}
              className="flex w-full items-center gap-2 rounded-xl border bg-white p-3 text-left transition hover:bg-gray-50"
            >
              <FaExclamationTriangle className="text-red-500" />
              <span className="font-medium text-slate-800">Report Lost Card</span>
            </button>
          </div>
        </div>

        <div ref={companyDocsRef} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">HR Policies & Company Docs</h2>
          </div>
          {policyDocs.length === 0 ? (
            <p className="text-sm text-slate-500">No HR policy documents available yet.</p>
          ) : (
            <div className="space-y-3">
              {policyDocs.map((doc) => (
                <div key={doc._id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{doc.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Updated {new Date(doc.updatedAt || doc.createdAt).toLocaleDateString()} • {formatBytes(doc.fileSize)}
                    </p>
                    <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${statusClass(doc)}`}>
                      {statusLabel(doc)}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => handlePreviewDocument(doc)} title="Preview" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#0a8f6c] transition">
                      <FaEye className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleDownloadDocument(doc)} title="Download" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#0a8f6c] transition">
                      <FaDownload className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">My Uploaded Documents</h2>
          {myUploadedDocs.length === 0 ? (
            <p className="text-sm text-slate-500">You have not uploaded any documents yet.</p>
          ) : (
            <div className="space-y-3">
              {myUploadedDocs.map((doc) => (
                <div key={doc._id} className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{doc.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatBytes(doc.fileSize)} • Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                      {doc.metadata?.isReupload ? ' • Replaced previous file' : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${statusClass(doc)}`}>
                        {statusLabel(doc)}
                      </span>
                      {doc.metadata?.isReupload ? (
                        <span className="inline-block rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                          Re-uploaded
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => handlePreviewDocument(doc)} title="Preview" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#0a8f6c] transition">
                      <FaEye className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleDownloadDocument(doc)} title="Download" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#0a8f6c] transition">
                      <FaDownload className="w-4 h-4" />
                    </button>
                    {canEmployeeDeleteOwnDocument(doc) ? (
                    <button type="button" onClick={() => setDeleteDoc(doc)} title="Delete" className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition">
                      <FaTrash className="w-4 h-4" />
                    </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hrms-main-rail">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm min-w-0">
            <h3 className="mb-4 border-l-4 border-[#20C997] pl-3 text-2xl font-semibold text-slate-900">Data Privacy & Security</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <FaShieldAlt className="mb-2 text-[#20C997]" />
                <p className="font-semibold text-slate-800">AES-256 Encryption</p>
                <p className="text-sm text-slate-500">All uploaded files are encrypted using enterprise-grade standards.</p>
              </div>
              <div>
                <FaClock className="mb-2 text-[#20C997]" />
                <p className="font-semibold text-slate-800">Retention Policy</p>
                <p className="text-sm text-slate-500">Documents are retained based on compliance and policy timelines.</p>
              </div>
              <div>
                <FaClipboardList className="mb-2 text-[#20C997]" />
                <p className="font-semibold text-slate-800">Access Logs</p>
                <p className="text-sm text-slate-500">Every preview/download is logged in your security audit trail.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-[#0a8f6c] to-[#006D4E] p-5 text-white shadow-sm">
            <p className="text-3xl font-semibold leading-tight">Need help with your documents?</p>
            <p className="mt-2 text-sm text-white/85">
              Connect with HR support for verification and document validity questions.
            </p>
            <button
              type="button"
              onClick={() => navigate('/helpdesk')}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#006D4E]"
            >
              <FaHeadset /> Chat with HR
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Delete document?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete <strong>{deleteDoc.name || deleteDoc.fileName}</strong>? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteDoc(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDocument}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsAndIdPage;
