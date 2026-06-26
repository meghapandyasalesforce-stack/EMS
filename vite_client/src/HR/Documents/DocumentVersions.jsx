import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaHistory, FaDownload, FaArrowLeft, FaClock } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios, { openDocumentPreview, saveDocumentDownload } from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import logger from '../../utils/logger';

const DocumentVersions = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [document, setDocument] = useState(null);
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchVersions();
    }, [id]);

    const fetchVersions = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/v1/admin/documents/${id}/versions`, { withCredentials: true });
            setDocument(response.data?.data?.document);
            setVersions(response.data?.data?.versions || []);
        } catch (error) {
            logger.error('Error fetching versions:', error);
            toast.error('Failed to load document versions');
        } finally {
            setLoading(false);
        }
    };

    const handleVersionDownload = async (version) => {
        try {
            const fileName = version.fileName || document?.name || 'document';
            await saveDocumentDownload(
                id,
                fileName,
                {
                    ...(version.isCurrent ? {} : { version: version.version }),
                    scope: 'admin',
                }
            );
        } catch (error) {
            logger.error('Error downloading version:', error);
            toast.error('Failed to download document version');
        }
    };

    const handleVersionPreview = async (version) => {
        try {
            await openDocumentPreview(
                id,
                {
                    ...(version.isCurrent ? {} : { version: version.version }),
                    scope: 'admin',
                }
            );
        } catch (error) {
            logger.error('Error previewing version:', error);
            toast.error('Failed to open document preview');
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading document versions..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6 flex items-center gap-4">
                    <button
                        onClick={() => navigate('/documents')}
                        className="text-gray-600 hover:text-gray-800"
                    >
                        <FaArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Document Version History</h1>
                        <p className="text-gray-600 mt-1">{document?.name}</p>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-theme-secondary/10 p-3 rounded-lg">
                            <FaHistory className="w-6 h-6 text-theme-secondary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800">{document?.name}</h2>
                            {document?.description && (
                                <p className="text-sm text-gray-600">{document.description}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        {versions.map((version, index) => (
                            <div
                                key={index}
                                className={`border rounded-lg p-4 ${
                                    version.isCurrent
                                        ? 'border-theme-secondary bg-theme-secondary/10'
                                        : 'border-gray-200 bg-white'
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                version.isCurrent
                                                    ? 'bg-theme-secondary text-white'
                                                    : 'bg-gray-200 text-gray-700'
                                            }`}>
                                                Version {version.version}
                                                {version.isCurrent && ' (Current)'}
                                            </span>
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <FaClock className="w-4 h-4" />
                                                {new Date(version.uploadedAt).toLocaleString()}
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-700 mb-2">
                                            <strong>File:</strong> {version.fileName}
                                        </p>
                                        {version.uploadedBy && (
                                            <p className="text-sm text-gray-600">
                                                <strong>Uploaded by:</strong> {version.uploadedBy.name || 'Unknown'}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleVersionPreview(version)}
                                            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                                        >
                                            Preview
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleVersionDownload(version)}
                                            className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition flex items-center gap-2"
                                        >
                                            <FaDownload className="w-4 h-4" />
                                            Download
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {versions.length === 0 && (
                        <div className="text-center py-12">
                            <FaHistory className="mx-auto text-gray-400 text-5xl mb-4" />
                            <p className="text-gray-500">No version history available</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocumentVersions;

