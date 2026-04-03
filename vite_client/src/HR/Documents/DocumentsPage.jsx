import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FaFileAlt, FaDownload, FaUpload, FaFolder, FaCheckCircle, FaTimesCircle, FaClock, FaUser, FaHistory } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import logger from '../../utils/logger';
import { isHR } from '../../utils/managerHelper';
import { ADMIN_DOCUMENTS_ENDPOINT } from '../../utils/constant';

const DOCUMENT_CATEGORY_OPTIONS = [
    'Employee', 'Company', 'Policy', 'Contract', 'Certificate',
    'Training', 'Compliance', 'Financial', 'Legal', 'Other'
];

const DocumentsPage = () => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    
    // Check if user is HR or Admin
    const isHRUser = useMemo(() => {
        const userRole = user?.role || employee?.role;
        if (userRole === 'admin') return true;
        const userObj = user || employee;
        return isHR(userObj);
    }, [user, employee]);
    const [documents, setDocuments] = useState([]);
    const [pendingDocuments, setPendingDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [filter, setFilter] = useState('all');
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadName, setUploadName] = useState('');
    const [uploadCategory, setUploadCategory] = useState('Company');
    const [uploadDescription, setUploadDescription] = useState('');
    const [uploading, setUploading] = useState(false);

    const resetUploadForm = () => {
        setUploadFile(null);
        setUploadName('');
        setUploadCategory('Company');
        setUploadDescription('');
    };

    const openUploadModal = () => {
        resetUploadForm();
        setShowUploadModal(true);
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!uploadFile) {
            toast.error('Please choose a file');
            return;
        }
        const name = uploadName.trim() || uploadFile.name;
        const formData = new FormData();
        formData.append('document', uploadFile);
        formData.append('name', name);
        formData.append('category', uploadCategory);
        if (uploadDescription.trim()) {
            formData.append('description', uploadDescription.trim());
        }
        try {
            setUploading(true);
            await axios.post(`${ADMIN_DOCUMENTS_ENDPOINT}/upload`, formData, { withCredentials: true });
            toast.success('Document uploaded successfully');
            setShowUploadModal(false);
            resetUploadForm();
            await fetchDocuments(false);
            if (isHRUser) await fetchPendingDocuments();
        } catch (error) {
            logger.error('Error uploading document:', error);
            toast.error(error.response?.data?.message || 'Failed to upload document');
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
        if (isHRUser) {
            fetchPendingDocuments();
        }
    }, [activeTab, filter, isHRUser]);

    const fetchDocuments = async (showFullPageLoading = true) => {
        try {
            if (showFullPageLoading) setLoading(true);
            const params = {};
            if (filter !== 'all') {
                params.category = filter;
            }
            // For HR, show all documents including pending ones
            const response = await axios.get('/v1/both/documents', { 
                params,
                withCredentials: true 
            });
            setDocuments(response.data?.data || []);
        } catch (error) {
            logger.error('Error fetching documents:', error);
            toast.error('Failed to load documents. Please try again.');
        } finally {
            if (showFullPageLoading) setLoading(false);
        }
    };

    const fetchPendingDocuments = async () => {
        try {
            const response = await axios.get('/v1/admin/documents/pending', { withCredentials: true });
            setPendingDocuments(response.data?.data || []);
        } catch (error) {
            logger.error('Error fetching pending documents:', error);
        }
    };

    const handleApprove = async (documentId) => {
        try {
            await axios.post(`/v1/admin/documents/${documentId}/approve`, {}, { withCredentials: true });
            toast.success('Document approved successfully!');
            fetchDocuments();
            fetchPendingDocuments();
        } catch (error) {
            logger.error('Error approving document:', error);
            toast.error('Failed to approve document');
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            toast.error('Please provide a rejection reason');
            return;
        }
        try {
            await axios.post(`/v1/admin/documents/${selectedDoc._id}/reject`, 
                { rejectionReason: rejectReason }, 
                { withCredentials: true }
            );
            toast.success('Document rejected successfully!');
            setShowRejectModal(false);
            setRejectReason('');
            setSelectedDoc(null);
            fetchDocuments();
            fetchPendingDocuments();
        } catch (error) {
            logger.error('Error rejecting document:', error);
            toast.error('Failed to reject document');
        }
    };

    const openRejectModal = (doc) => {
        setSelectedDoc(doc);
        setShowRejectModal(true);
    };

    if (loading) {
        return <LoadingSpinner message="Loading documents..." />;
    }

    const displayDocuments = activeTab === 'pending' ? pendingDocuments : documents;
    const pendingCount = pendingDocuments.length;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex justify-between items-center gap-4 relative z-10">
                    <div className="min-w-0">
                        <h1 className="text-3xl font-bold text-gray-800">Document Management</h1>
                        <p className="text-gray-600 mt-1">Manage company documents and employee uploads</p>
                    </div>
                    {isHRUser && (
                        <button
                            type="button"
                            onClick={openUploadModal}
                            className="shrink-0 bg-theme-secondary text-white px-4 py-2 rounded-lg hover:bg-theme-primary transition flex items-center gap-2 cursor-pointer"
                        >
                            <FaUpload className="w-4 h-4" />
                            Upload Document
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-lg shadow-md mb-6">
                    <div className="flex border-b">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-6 py-3 font-medium ${activeTab === 'all' ? 'border-b-2 border-theme-secondary text-theme-secondary' : 'text-gray-600'}`}
                        >
                            All Documents ({documents.length})
                        </button>
                        {isHRUser && (
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`px-6 py-3 font-medium relative ${activeTab === 'pending' ? 'border-b-2 border-theme-secondary text-theme-secondary' : 'text-gray-600'}`}
                            >
                                Pending Approval ({pendingCount})
                                {pendingCount > 0 && (
                                    <span className="absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                        {pendingCount}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Filters for All Documents */}
                {activeTab === 'all' && (
                    <div className="bg-white rounded-lg shadow-md mb-6 p-4">
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                    filter === 'all' 
                                        ? 'bg-theme-secondary text-white' 
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilter('Employee')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                    filter === 'Employee' 
                                        ? 'bg-theme-secondary text-white' 
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Employee Documents
                            </button>
                            <button
                                onClick={() => setFilter('Company')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                    filter === 'Company' 
                                        ? 'bg-theme-secondary text-white' 
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Company Documents
                            </button>
                            <button
                                onClick={() => setFilter('Policy')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                    filter === 'Policy' 
                                        ? 'bg-theme-secondary text-white' 
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Policies
                            </button>
                        </div>
                    </div>
                )}

                {/* Documents Grid/Table */}
                {activeTab === 'pending' ? (
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="p-4 bg-yellow-50 border-b border-yellow-200">
                            <h2 className="text-lg font-semibold text-yellow-800">
                                Documents Pending HR Approval
                            </h2>
                            <p className="text-sm text-yellow-600 mt-1">
                                Review and approve or reject employee-uploaded documents
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded By</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {pendingDocuments.map((doc) => (
                                        <tr key={doc._id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-theme-secondary/10 p-2 rounded-lg">
                                                        <FaFileAlt className="w-5 h-5 text-theme-secondary" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900">{doc.name}</div>
                                                        {doc.description && (
                                                            <div className="text-sm text-gray-500">{doc.description}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <FaUser className="w-4 h-4 text-gray-400" />
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {doc.uploadedBy?.name || 'Unknown'}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {doc.uploadedBy?.employeeId || 'N/A'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 py-1 rounded text-xs bg-theme-secondary/10 text-theme-secondary">
                                                    {doc.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {(doc.fileSize / 1024).toFixed(2)} KB
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(doc.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <a
                                                        href={doc.fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-theme-secondary hover:text-theme-secondary"
                                                        title="View Document"
                                                    >
                                                        <FaDownload className="w-4 h-4" />
                                                    </a>
                                                    {isHRUser && (
                                                        <>
                                                            <button
                                                                onClick={() => handleApprove(doc._id)}
                                                                className="text-theme-primary hover:text-theme-primary"
                                                                title="Approve"
                                                            >
                                                                <FaCheckCircle className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => openRejectModal(doc)}
                                                                className="text-red-600 hover:text-red-800"
                                                                title="Reject"
                                                            >
                                                                <FaTimesCircle className="w-5 h-5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {pendingDocuments.length === 0 && (
                                <div className="text-center py-12">
                                    <FaCheckCircle className="mx-auto text-green-400 text-5xl mb-4" />
                                    <p className="text-gray-500">No documents pending approval.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {documents.map((doc) => (
                            <div key={doc._id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="bg-theme-secondary/10 p-3 rounded-lg">
                                        <FaFileAlt className="w-6 h-6 text-theme-secondary" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-800">{doc.name}</h3>
                                        <p className="text-sm text-gray-600">{doc.category}</p>
                                        {doc.uploadedBy && (
                                            <div className="mt-1">
                                                <p className="text-xs text-gray-500">
                                                    By: {doc.uploadedBy.name}
                                                    {doc.uploadedBy.employeeId && ` (${doc.uploadedBy.employeeId})`}
                                                </p>
                                                {doc.uploadedBy.department && (
                                                    <p className="text-xs text-gray-400">
                                                        {doc.uploadedBy.department}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Approval Status Badge */}
                                {doc.requiresApproval && (
                                    <div className="mb-3">
                                        <span className={`px-2 py-1 rounded text-xs ${
                                            doc.approvalStatus === 'Approved' 
                                                ? 'bg-theme-primary/10 text-theme-primary' 
                                                : doc.approvalStatus === 'Rejected'
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {doc.approvalStatus === 'Approved' && <FaCheckCircle className="inline mr-1" />}
                                            {doc.approvalStatus === 'Rejected' && <FaTimesCircle className="inline mr-1" />}
                                            {doc.approvalStatus === 'Pending' && <FaClock className="inline mr-1" />}
                                            {doc.approvalStatus || 'Pending'}
                                        </span>
                                    </div>
                                )}

                                {/* Action buttons for pending documents */}
                                {isHRUser && doc.requiresApproval && doc.approvalStatus === 'Pending' && (
                                    <div className="mb-3 flex gap-2">
                                        <button
                                            onClick={() => handleApprove(doc._id)}
                                            className="flex-1 bg-theme-primary text-white px-3 py-1 rounded text-sm hover:bg-theme-primary transition"
                                        >
                                            <FaCheckCircle className="inline mr-1" />
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => openRejectModal(doc)}
                                            className="flex-1 bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition"
                                        >
                                            <FaTimesCircle className="inline mr-1" />
                                            Reject
                                        </button>
                                    </div>
                                )}

                                {doc.rejectionReason && (
                                    <div className="mb-3 p-2 bg-red-50 rounded text-xs text-red-700">
                                        <strong>Rejection Reason:</strong> {doc.rejectionReason}
                                    </div>
                                )}

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-500">
                                            {(doc.fileSize / 1024).toFixed(2)} KB
                                        </span>
                                        {doc.version > 1 && (
                                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                                v{doc.version}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {doc.version > 1 && (
                                            <button
                                                onClick={() => navigate(`/documents/${doc._id}/versions`)}
                                                className="text-purple-600 hover:text-purple-800"
                                                title="View Versions"
                                            >
                                                <FaHistory className="w-4 h-4" />
                                            </button>
                                        )}
                                        <a
                                            href={doc.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-theme-secondary hover:text-theme-secondary"
                                            title="Download"
                                        >
                                            <FaDownload className="w-5 h-5" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {documents.length === 0 && (
                            <div className="col-span-3 text-center py-12">
                                <FaFolder className="mx-auto text-gray-400 text-5xl mb-4" />
                                <p className="text-gray-500">No documents found.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Upload modal */}
                {showUploadModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
                        <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                Upload document
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                                PDF, Word, PNG or JPEG up to 5 MB. HR uploads are approved automatically.
                            </p>
                            <form onSubmit={handleUploadSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="upload-file" className="block text-sm font-medium text-gray-700 mb-1">
                                        File <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="upload-file"
                                        type="file"
                                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,image/*"
                                        className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-theme-secondary file:text-white"
                                        onChange={(ev) => {
                                            const f = ev.target.files?.[0];
                                            setUploadFile(f || null);
                                            if (f) {
                                                setUploadName((prev) =>
                                                    prev.trim() ? prev : f.name.replace(/\.[^/.]+$/, '')
                                                );
                                            }
                                        }}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="upload-name" className="block text-sm font-medium text-gray-700 mb-1">
                                        Display name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="upload-name"
                                        type="text"
                                        value={uploadName}
                                        onChange={(ev) => setUploadName(ev.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        placeholder="e.g. Employee handbook 2025"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="upload-category" className="block text-sm font-medium text-gray-700 mb-1">
                                        Category
                                    </label>
                                    <select
                                        id="upload-category"
                                        value={uploadCategory}
                                        onChange={(ev) => setUploadCategory(ev.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                    >
                                        {DOCUMENT_CATEGORY_OPTIONS.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="upload-description" className="block text-sm font-medium text-gray-700 mb-1">
                                        Description (optional)
                                    </label>
                                    <textarea
                                        id="upload-description"
                                        value={uploadDescription}
                                        onChange={(ev) => setUploadDescription(ev.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        placeholder="Short summary"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowUploadModal(false);
                                            resetUploadForm();
                                        }}
                                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={uploading || !uploadFile}
                                        className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition disabled:opacity-50"
                                    >
                                        {uploading ? 'Uploading…' : 'Upload'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {showRejectModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                Reject Document
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">
                                Document: <strong>{selectedDoc?.name}</strong>
                            </p>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Rejection Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                    rows="4"
                                    placeholder="Please provide a reason for rejection..."
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowRejectModal(false);
                                        setRejectReason('');
                                        setSelectedDoc(null);
                                    }}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReject}
                                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                                >
                                    Reject Document
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentsPage;


