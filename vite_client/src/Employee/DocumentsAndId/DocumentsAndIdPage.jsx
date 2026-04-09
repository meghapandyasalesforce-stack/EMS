import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaFileAlt,
  FaDownload,
  FaIdCard,
  FaShareAlt,
  FaExclamationTriangle,
  FaEye
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios, { getUploadUrl } from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';

const formatBytes = (bytes) => {
  const size = Number(bytes || 0);
  if (!size) return '--';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const DocumentsAndIdPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [idCard, setIdCard] = useState(null);

  useEffect(() => {
    const loadPageData = async () => {
      try {
        setLoading(true);
        const [documentsResp, idCardResp] = await Promise.allSettled([
          axios.get('/v1/both/documents', { withCredentials: true }),
          axios.get('/v1/admin/id-cards/employee/my-card', { withCredentials: true })
        ]);

        if (documentsResp.status === 'fulfilled') {
          setDocuments(documentsResp.value?.data?.data || []);
        }

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
    };

    loadPageData();
  }, []);

  const policyDocs = useMemo(() => {
    return (documents || [])
      .filter((doc) => ['Policy', 'Company'].includes(doc?.category))
      .slice(0, 4);
  }, [documents]);

  const contractDocs = useMemo(() => {
    return (documents || [])
      .filter((doc) => ['Employee', 'Contract', 'Legal'].includes(doc?.category))
      .slice(0, 6);
  }, [documents]);

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
    <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Documents & ID Card</h1>
          <p className="text-gray-600 mt-1">Access your policy documents, contracts, and digital employee ID card.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Company Policies</h2>
                <button
                  onClick={() => navigate('/documents')}
                  className="text-sm text-theme-secondary hover:underline"
                >
                  View All
                </button>
              </div>

              {policyDocs.length === 0 ? (
                <p className="text-sm text-gray-500">No policy documents available.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {policyDocs.map((doc) => (
                    <div key={doc._id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{doc.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Updated {new Date(doc.updatedAt || doc.createdAt).toLocaleDateString()} - {formatBytes(doc.fileSize)}
                        </p>
                      </div>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-theme-secondary"
                        title="Open document"
                      >
                        <FaDownload />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">My Contracts & Letters</h2>
              {contractDocs.length === 0 ? (
                <p className="text-sm text-gray-500">No contracts or letters available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max text-sm">
                    <thead className="text-left text-gray-500 border-b">
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
                          <td className="py-3 pr-3 text-gray-800">{doc.name}</td>
                          <td className="py-3 pr-3 text-gray-600">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 pr-3">
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                doc.approvalStatus === 'Rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : doc.approvalStatus === 'Pending'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-theme-primary/10 text-theme-primary'
                              }`}
                            >
                              {doc.approvalStatus || 'Active'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-theme-secondary hover:underline"
                            >
                              <FaEye className="text-xs" /> View
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Digital ID Card</h2>
              {idCard ? (
                <div
                  className="rounded-2xl p-4 text-white"
                  style={{
                    background: `linear-gradient(135deg, ${idCard.cardDesign?.accentColor || '#2563eb'}, ${idCard.cardDesign?.backgroundColor || '#059669'})`
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-xl">{idCard.cardDesign?.companyName || 'paarsiv'}</p>
                    <FaIdCard className="opacity-80" />
                  </div>
                  <p className="text-[11px] opacity-80">EMPLOYEE ID</p>

                  <div className="flex justify-center my-3">
                    {idCard.employeeId?.profilePhoto?.url || idCard.employeeId?.profilePhoto ? (
                      <img
                        src={getUploadUrl(idCard.employeeId.profilePhoto.url || idCard.employeeId.profilePhoto)}
                        alt="Employee"
                        className="w-16 h-16 rounded-full border-2 border-white/80 object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/70" />
                    )}
                  </div>

                  <p className="text-center font-semibold">
                    {idCard.employeeId?.name} {idCard.employeeId?.lastName}
                  </p>
                  <p className="text-center text-xs opacity-90">{idCard.employeeId?.jobTitle || 'Employee'}</p>

                  <div className="grid grid-cols-2 gap-3 mt-4 text-[11px]">
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
                <div className="border rounded-lg p-4 text-sm text-gray-600">
                  No ID card found. Please contact HR/admin.
                </div>
              )}
            </div>

            <button
              onClick={handleDownloadIdCard}
              className="w-full bg-white border rounded-xl p-3 text-left hover:bg-gray-50 transition flex items-center gap-2"
            >
              <FaDownload className="text-gray-600" />
              <span className="font-medium text-gray-800">Download ID PDF</span>
            </button>

            <button
              onClick={handleShareCard}
              className="w-full bg-white border rounded-xl p-3 text-left hover:bg-gray-50 transition flex items-center gap-2"
            >
              <FaShareAlt className="text-gray-600" />
              <span className="font-medium text-gray-800">Share Digital Card</span>
            </button>

            <button
              onClick={() => toast.info('Lost card reporting will be enabled soon.')}
              className="w-full bg-white border rounded-xl p-3 text-left hover:bg-gray-50 transition flex items-center gap-2"
            >
              <FaExclamationTriangle className="text-red-500" />
              <span className="font-medium text-gray-800">Report Lost Card</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentsAndIdPage;
