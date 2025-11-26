import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { ORGANIZATION_ENDPOINT } from '../../utils/constant';
import { FiUpload, FiFile, FiCheckCircle, FiXCircle, FiClock, FiFileText } from 'react-icons/fi';
import logger from '../../utils/logger';

const OrganizationVerification = () => {
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth || {});
    const [organization, setOrganization] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        businessRegistrationNumber: '',
        taxId: '',
        documents: []
    });

    useEffect(() => {
        fetchOrganization();
    }, []);

    const fetchOrganization = async () => {
        try {
            const response = await axios.get(`${ORGANIZATION_ENDPOINT}/details`);
            if (response.data.success) {
                setOrganization(response.data.organization);
                setFormData({
                    businessRegistrationNumber: response.data.organization.businessRegistrationNumber || '',
                    taxId: response.data.organization.taxId || '',
                    documents: response.data.organization.verificationDocuments || []
                });
            }
        } catch (error) {
            logger.error('Failed to fetch organization', { error: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleDocumentUpload = async (e, documentType) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error('File size must be less than 10MB');
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('document', file);
            formData.append('type', documentType);

            const response = await axios.post(`${ORGANIZATION_ENDPOINT}/verification-document`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.success) {
                toast.success('Document uploaded successfully');
                await fetchOrganization();
            }
        } catch (error) {
            toast.error('Failed to upload document');
            logger.error('Document upload error', { error: error.message });
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const response = await axios.put(`${ORGANIZATION_ENDPOINT}/verification`, {
                businessRegistrationNumber: formData.businessRegistrationNumber,
                taxId: formData.taxId
            });

            if (response.data.success) {
                toast.success('Verification information saved');
                await fetchOrganization();
            }
        } catch (error) {
            toast.error('Failed to save verification information');
            logger.error('Verification save error', { error: error.message });
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = () => {
        const status = organization?.verificationStatus || 'pending';
        const statusConfig = {
            pending: { color: 'bg-yellow-100 text-yellow-800', icon: <FiClock className="w-4 h-4" />, label: 'Pending Review' },
            verified: { color: 'bg-green-100 text-green-800', icon: <FiCheckCircle className="w-4 h-4" />, label: 'Verified' },
            rejected: { color: 'bg-red-100 text-red-800', icon: <FiXCircle className="w-4 h-4" />, label: 'Rejected' }
        };
        const config = statusConfig[status] || statusConfig.pending;
        
        return (
            <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full ${config.color}`}>
                {config.icon}
                <span className="font-semibold">{config.label}</span>
            </div>
        );
    };

    if (loading && !organization) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Organization Verification</h1>
                    <p className="mt-2 text-gray-600">
                        Verify your organization to unlock additional features and build trust
                    </p>
                </div>

                {/* Status Banner */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">Verification Status</h2>
                        {getStatusBadge()}
                    </div>
                    {organization?.verificationStatus === 'rejected' && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-800 text-sm">
                                Your verification was rejected. Please review your information and resubmit.
                            </p>
                        </div>
                    )}
                </div>

                {/* Verification Form */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Business Information</h2>
                    
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Business Registration Number
                            </label>
                            <input
                                type="text"
                                value={formData.businessRegistrationNumber}
                                onChange={(e) => setFormData(prev => ({ ...prev, businessRegistrationNumber: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter your business registration number"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Your official business registration or incorporation number
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tax ID / EIN
                            </label>
                            <input
                                type="text"
                                value={formData.taxId}
                                onChange={(e) => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter your tax identification number"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Your tax identification number (EIN, VAT, etc.)
                            </p>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Information'}
                        </button>
                    </div>
                </div>

                {/* Document Upload */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Verification Documents</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Upload official documents to verify your organization. Accepted formats: PDF, JPG, PNG (max 10MB)
                    </p>

                    <div className="space-y-4">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                            <div className="text-center">
                                <FiFileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <label className="cursor-pointer">
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) => handleDocumentUpload(e, 'business-license')}
                                        className="hidden"
                                        disabled={uploading}
                                    />
                                    <span className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-block">
                                        {uploading ? 'Uploading...' : 'Upload Business License'}
                                    </span>
                                </label>
                                <p className="mt-2 text-xs text-gray-500">Business license or registration certificate</p>
                            </div>
                        </div>

                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                            <div className="text-center">
                                <FiFileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <label className="cursor-pointer">
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) => handleDocumentUpload(e, 'tax-document')}
                                        className="hidden"
                                        disabled={uploading}
                                    />
                                    <span className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-block">
                                        {uploading ? 'Uploading...' : 'Upload Tax Document'}
                                    </span>
                                </label>
                                <p className="mt-2 text-xs text-gray-500">Tax identification document</p>
                            </div>
                        </div>

                        {/* Uploaded Documents */}
                        {formData.documents.length > 0 && (
                            <div className="mt-6">
                                <h3 className="text-sm font-semibold text-gray-900 mb-4">Uploaded Documents</h3>
                                <div className="space-y-2">
                                    {formData.documents.map((doc, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center space-x-3">
                                                <FiFile className="w-5 h-5 text-gray-400" />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{doc.filename || doc.type}</p>
                                                    <p className="text-xs text-gray-500">
                                                        Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <a
                                                href={doc.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-700 text-sm"
                                            >
                                                View
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrganizationVerification;

