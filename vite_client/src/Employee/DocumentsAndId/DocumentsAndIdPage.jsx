import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  FaSearch,
  FaDownload,
  FaIdCard,
  FaShareAlt,
  FaExclamationTriangle,
  FaEye,
  FaShieldAlt,
  FaClock,
  FaClipboardList,
  FaHeadset,
  FaUpload
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios, { getUploadUrl, openDocumentPreview, saveDocumentDownload } from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';

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
  const user = useSelector((state) => state.auth.user);
  const employee = useSelector((state) => state.employeeDetails.employee);
  const myEmployeeId = String(employee?._id || employee?.id || user?._id || user?.id || '');

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [idCard, setIdCard] = useState(null);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef(null);
  const companyDocsRef = useRef(null);

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
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }, [documents, isOwnDocument]);

  const policyDocs = useMemo(() => {
    return (documents || [])
      .filter((doc) => isHrSharedDocument(doc))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }, [documents, isHrSharedDocument]);

  const contractDocs = useMemo(() => {
    return myUploadedDocs
      .filter((doc) => ['Employee', 'Contract', 'Legal'].includes(doc?.category))
      .slice(0, 6);
  }, [myUploadedDocs]);

  const recentlyUpdatedDocs = useMemo(() => {
    return [...myUploadedDocs, ...policyDocs]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 4);
  }, [myUploadedDocs, policyDocs]);

  const statusLabel = (doc) => {
    if (doc.approvalStatus === 'Rejected') return 'Rejected';
    if (doc.requiresApproval && doc.approvalStatus === 'Pending') return 'Pending HR approval';
    if (doc.approvalStatus === 'Approved') return 'Approved';
    return doc.approvalStatus || 'Active';
  };

  const statusClass = (doc) => {
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
      const response = await axios.get(`/v1/admin/id-cards/card/${idCard._id}/download`, {
        responseType: 'blob',
        withCredentials: true
      });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `id-card-${idCard.employeeId?.employeeId || idCard.cardNumber || 'card'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('ID card PDF downloaded');
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

  if (loading) {
    return <LoadingSpinner message="Loading documents & ID card..." />;
  }

  return (
    <div className="min-h-screen bg-[#F4F6FB] p-4 sm:p-6 transition-all duration-300">
      <div className="mx-auto max-w-[1240px] space-y-6">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">Personal Documents</h1>
              <p className="mt-1 text-slate-600">Manage your identity files and secure records in one place.</p>
            </div>
            <div className="relative w-full md:w-[360px]">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#20C997]/40 focus:ring-2 focus:ring-[#20C997]/20"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <span className="inline-flex rounded-full bg-[#20C997]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#0a8f6c]">
                  Company Identity
                </span>
                <h2 className="mt-2 text-3xl font-semibold text-slate-900">Digital Employee ID</h2>
                {idCard ? (
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center gap-3">
                      {idCard.employeeId?.profilePhoto?.url || idCard.employeeId?.profilePhoto ? (
                        <img
                          src={getUploadUrl(idCard.employeeId.profilePhoto.url || idCard.employeeId.profilePhoto)}
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
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handlePreviewDocument(doc)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                          >
                            <FaEye className="text-xs" /> Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadDocument(doc)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                          >
                            <FaDownload className="text-xs" /> Download
                          </button>
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
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => handlePreviewDocument(doc)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          title="Preview"
                        >
                          <FaEye /> Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadDocument(doc)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          title="Download"
                        >
                          <FaDownload /> Download
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
                        </p>
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${statusClass(doc)}`}>
                          {statusLabel(doc)}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => handlePreviewDocument(doc)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-[#0a8f6c] hover:underline"
                        >
                          <FaEye className="text-xs" /> Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadDocument(doc)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-[#0a8f6c] hover:underline"
                        >
                          <FaDownload className="text-xs" /> Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">My Contracts & Letters</h2>
              {contractDocs.length === 0 ? (
                <p className="text-sm text-slate-500">No contracts or letters available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max text-sm">
                    <thead className="border-b text-left text-slate-500">
                      <tr>
                        <th className="py-2 pr-3">Document Name</th>
                        <th className="py-2 pr-3">Date Signed</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractDocs.map((doc) => (
                        <tr key={doc._id} className="border-b last:border-b-0">
                          <td className="py-3 pr-3 text-slate-800">{doc.name}</td>
                          <td className="py-3 pr-3 text-slate-600">{new Date(doc.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 pr-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(doc)}`}>
                              {statusLabel(doc)}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-3 justify-end">
                              <button
                                type="button"
                                onClick={() => handlePreviewDocument(doc)}
                                className="inline-flex items-center gap-1 text-[#0a8f6c] hover:underline"
                              >
                                <FaEye className="text-xs" /> Preview
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadDocument(doc)}
                                className="inline-flex items-center gap-1 text-[#0a8f6c] hover:underline"
                              >
                                <FaDownload className="text-xs" /> Download
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:col-span-2">
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

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-800">Digital ID Card</h2>
              {idCard ? (
                <div
                  className="rounded-2xl p-4 text-white"
                  style={{
                    background: `linear-gradient(135deg, ${idCard.cardDesign?.accentColor || '#2563eb'}, ${idCard.cardDesign?.backgroundColor || '#059669'})`
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-semibold">{idCard.cardDesign?.companyName || 'paarsiv'}</p>
                    <FaIdCard className="opacity-80" />
                  </div>
                  <p className="text-[11px] opacity-80">EMPLOYEE ID</p>

                  <div className="my-3 flex justify-center">
                    {idCard.employeeId?.profilePhoto?.url || idCard.employeeId?.profilePhoto ? (
                      <img
                        src={getUploadUrl(idCard.employeeId.profilePhoto.url || idCard.employeeId.profilePhoto)}
                        alt="Employee"
                        className="h-16 w-16 rounded-full border-2 border-white/80 object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full border-2 border-white/70 bg-white/20" />
                    )}
                  </div>

                  <p className="text-center font-semibold">
                    {idCard.employeeId?.name} {idCard.employeeId?.lastName}
                  </p>
                  <p className="text-center text-xs opacity-90">{idCard.employeeId?.jobTitle || 'Employee'}</p>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <p className="opacity-70">ID NUMBER</p>
                      <p className="font-medium">{idCard.employeeId?.employeeId || '--'}</p>
                    </div>
                    <div>
                      <p className="opacity-70">CARD NO.</p>
                      <p className="font-medium">{idCard.cardNumber || '--'}</p>
                    </div>
                    <div>
                      <p className="opacity-70">DEPARTMENT</p>
                      <p className="font-medium">{idCard.employeeId?.department || '--'}</p>
                    </div>
                    <div>
                      <p className="opacity-70">STATUS</p>
                      <p className="font-medium capitalize">{idCard.status || '--'}</p>
                    </div>
                  </div>
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
      </div>
    </div>
  );
};

export default DocumentsAndIdPage;
