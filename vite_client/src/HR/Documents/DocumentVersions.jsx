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
        <div className="page-shell bg-gray-50 transition-all duration-300">
            <div className="page-shell-inner hrms-stack">
                <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                    <button
                        onClick={() => navigate('/documents')}
                        className="mt-1 shrink-0 rounded-lg p-1 text-gray-600 hover:bg-white hover:text-gray-800 sm:mt-0"
                        aria-label="Back to documents"
                    >
                        <FaArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold leading-tight text-gray-800 sm:text-3xl">Document Version History</h1>
                        <p className="mt-1 break-words text-gray-600">{document?.name}</p>
                    </div>
                </div>

                <div className="rounded-lg bg-white p-4 shadow-md sm:p-6">
                    <div className="mb-4 flex min-w-0 items-center gap-3 sm:mb-6">
                        <div className="shrink-0 rounded-lg bg-theme-secondary/10 p-3">
                            <FaHistory className="w-6 h-6 text-theme-secondary" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="break-words text-xl font-semibold text-gray-800">{document?.name}</h2>
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
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                                            <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
                                                version.isCurrent
                                                    ? 'bg-theme-secondary text-white'
                                                    : 'bg-gray-200 text-gray-700'
                                            }`}>
                                                Version {version.version}
                                                {version.isCurrent && ' (Current)'}
                                            </span>
                                            <div className="flex min-w-0 items-center gap-2 text-sm text-gray-600">
                                                <FaClock className="h-4 w-4 shrink-0" />
                                                {new Date(version.uploadedAt).toLocaleString()}
                                            </div>
                                        </div>
                                        <p className="mb-2 break-all text-sm text-gray-700">
                                            <strong>File:</strong> {version.fileName}
                                        </p>
                                        {version.uploadedBy && (
                                            <p className="text-sm text-gray-600">
                                                <strong>Uploaded by:</strong> {version.uploadedBy.name || 'Unknown'}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleVersionPreview(version)}
                                            className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-700 transition hover:bg-gray-50 sm:px-4"
                                        >
                                            Preview
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleVersionDownload(version)}
                                            className="flex items-center justify-center gap-2 rounded-lg bg-theme-secondary px-3 py-2 text-white transition hover:bg-theme-primary sm:px-4"
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
                        <div className="text-center py-8 sm:py-10">
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

