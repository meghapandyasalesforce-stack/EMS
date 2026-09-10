import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiFolder, FiUploadCloud } from 'react-icons/fi';
import { BOTH_DOCUMENTS_ENDPOINT, BOTH_PROFILE_ENDPOINT } from '../../utils/constant';
import { getCsrfToken } from '../../utils/authHelper';
import axios from '../../utils/axios';

const MARKSHEET_LEVELS = [
    { value: '10th', label: '10th' },
    { value: '12th', label: '12th' },
    { value: 'Diploma', label: 'Diploma' },
    { value: 'Graduation', label: 'Graduation' },
    { value: 'Post Graduation', label: 'Post Graduation' },
];

const DOCUMENT_SECTIONS = [
    {
        type: 'OFFER_LETTER',
        title: 'Offer Letter',
        accept: '.pdf,.doc,.docx',
        extraField: {
            key: 'effectiveDate',
            label: 'Effective Date',
            inputType: 'date',
        },
    },
    {
        type: 'AADHAR_CARD',
        title: 'Aadhaar Card',
        accept: '.pdf,.jpg,.jpeg,.png',
        extraField: {
            key: 'aadhaarNumber',
            label: 'Aadhaar Number',
            inputType: 'text',
            placeholder: 'XXXX XXXX XXXX',
            maxLength: 14,
        },
    },
    {
        type: 'PAN_CARD',
        title: 'Pan Card',
        accept: '.pdf,.jpg,.jpeg,.png',
        extraField: {
            key: 'panNumber',
            label: 'PAN Number',
            inputType: 'text',
            placeholder: 'ABCDE1234F',
            maxLength: 10,
            upperCase: true,
        },
    },
    {
        type: 'PASSPORT',
        title: 'Passport',
        accept: '.pdf,.jpg,.jpeg,.png',
        extraField: {
            key: 'passportNumber',
            label: 'Passport Number',
            inputType: 'text',
            placeholder: 'A1234567',
            maxLength: 8,
            upperCase: true,
        },
    },
];

const MARKSHEET_SECTION = {
    type: 'DEGREE_CERTIFICATE',
    title: 'Marksheet',
    accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx',
};

const getMarksheetLevel = (doc) =>
    String(doc?.metadata?.additionalInfo?.marksheetLevel || '').trim();

const getUploadKey = (documentType, marksheetLevel) =>
    marksheetLevel ? `${documentType}:${marksheetLevel}` : documentType;

const statusLabel = (doc) => {
    const status = doc?.approvalStatus || 'Pending';
    if (status === 'Pending') return 'Pending';
    if (status === 'Approved') return 'Approved';
    if (status === 'Rejected') return 'Rejected';
    return status;
};

const statusClass = (status) => {
    if (status === 'Rejected') return 'bg-red-100 text-red-700';
    if (status === 'Pending') return 'bg-amber-100 text-amber-800';
    if (status === 'Approved') return 'bg-emerald-100 text-emerald-800';
    return 'bg-slate-100 text-slate-700';
};

const inputClassName =
    'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition';

const JobDetails = () => {
    const [additionalInfo, setAdditionalInfo] = useState({});
    const [selectedMarksheetLevel, setSelectedMarksheetLevel] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [uploadedByType, setUploadedByType] = useState({});
    const [highlightOfferLetter, setHighlightOfferLetter] = useState(false);
    const fileRefs = useRef({});
    const offerLetterRef = useRef(null);

    const loadUploadedDocuments = useCallback(async () => {
        try {
            setLoadingDocs(true);
            const listUrl = BOTH_DOCUMENTS_ENDPOINT.startsWith('http')
                ? `${BOTH_DOCUMENTS_ENDPOINT}/mine`
                : `/api${BOTH_DOCUMENTS_ENDPOINT}/mine`;
            const response = await fetch(`${listUrl}?limit=100`, {
                method: 'GET',
                credentials: 'include',
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result.message || 'Failed to load documents');
            }

            const docs = Array.isArray(result.data) ? result.data : [];
            const byType = {};
            for (const doc of docs) {
                const type = doc.employeeJobDocumentType;
                if (!type) continue;

                if (type === 'DEGREE_CERTIFICATE') {
                    const level = getMarksheetLevel(doc);
                    if (!level) continue;
                    const key = getUploadKey(type, level);
                    if (!byType[key]) {
                        byType[key] = doc;
                    }
                    continue;
                }

                if (!byType[type]) {
                    byType[type] = doc;
                }
            }
            setUploadedByType(byType);
        } catch {
            setUploadedByType({});
        } finally {
            setLoadingDocs(false);
        }
    }, []);

    useEffect(() => {
        loadUploadedDocuments();
    }, [loadUploadedDocuments]);

    useEffect(() => {
        const fromFirstLogin = sessionStorage.getItem('redirectToOfferLetterOnLogin') === '1';
        let stopHighlightTimer;

        if (fromFirstLogin) {
            setHighlightOfferLetter(true);
            stopHighlightTimer = window.setTimeout(() => setHighlightOfferLetter(false), 6200);
            requestAnimationFrame(() => {
                offerLetterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        axios
            .post(`${BOTH_PROFILE_ENDPOINT}/ack-offer-letter-login-redirect`, {}, { withCredentials: true })
            .then(() => {
                sessionStorage.removeItem('redirectToOfferLetterOnLogin');
            })
            .catch(() => {});

        return () => {
            if (stopHighlightTimer) window.clearTimeout(stopHighlightTimer);
        };
    }, []);

    const handleAdditionalInfoChange = (type, field, value) => {
        setAdditionalInfo((prev) => ({
            ...prev,
            [type]: {
                ...(prev[type] || {}),
                [field]: value,
            },
        }));
    };

    const handleUpload = async (file, documentType, marksheetLevel = '') => {
        if (!file) {
            alert(`Please select a file for ${documentType}`);
            return;
        }

        if (documentType === 'DEGREE_CERTIFICATE' && !marksheetLevel) {
            alert('Please select a marksheet level (10th, 12th, Diploma, Graduation, or Post Graduation) before uploading.');
            return;
        }

        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('document', file);
            formData.append('documentType', documentType);

            const infoPayload = documentType === 'DEGREE_CERTIFICATE'
                ? { marksheetLevel }
                : additionalInfo[documentType];

            if (infoPayload && Object.keys(infoPayload).length > 0) {
                formData.append('additionalInfo', JSON.stringify(infoPayload));
            }

            const uploadUrl = BOTH_DOCUMENTS_ENDPOINT.startsWith('http')
                ? `${BOTH_DOCUMENTS_ENDPOINT}/upload`
                : `/api${BOTH_DOCUMENTS_ENDPOINT}/upload`;
            const csrf = getCsrfToken();
            const headers = {};
            if (csrf) headers['x-csrf-token'] = csrf;
            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData,
                credentials: 'include',
                headers,
            });

            const text = await response.text();
            let result = {};
            if (text && text.trim()) {
                try {
                    result = JSON.parse(text);
                } catch {
                    throw new Error(
                        response.ok
                            ? 'Invalid response from server'
                            : text.slice(0, 100) || `Upload failed (${response.status})`
                    );
                }
            }

            if (!response.ok) {
                throw new Error(result.message || `Failed to upload ${documentType} (${response.status})`);
            }

            const fileRefKey = getUploadKey(documentType, marksheetLevel);
            if (fileRefs.current[fileRefKey]) {
                fileRefs.current[fileRefKey].value = '';
            }
            await loadUploadedDocuments();
            alert(result.message || `${documentType} uploaded successfully!`);
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const renderUploadedStatus = (doc, levelLabel = '') => {
        const label = statusLabel(doc);
        const isRejected = label === 'Rejected';
        return (
            <div className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <p className={`text-sm font-medium ${isRejected ? 'text-red-700' : 'text-emerald-700'}`}>
                            {levelLabel ? `${levelLabel} — ` : ''}
                            {isRejected ? 'Rejected' : 'Uploaded'}
                        </p>
                        {doc.fileName ? (
                            <p className="mt-0.5 text-sm text-gray-500 truncate max-w-md">{doc.fileName}</p>
                        ) : null}
                    </div>
                    <span
                        className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(label)}`}
                    >
                        {label}
                    </span>
                </div>
                {isRejected && doc.rejectionReason ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        Reason: {doc.rejectionReason}
                    </p>
                ) : null}
            </div>
        );
    };

    const renderUploadForm = (section, { isReplace = false } = {}) => {
        const { type, accept, extraField } = section;
        const value = additionalInfo[type]?.[extraField.key] ?? '';

        return (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="flex flex-col min-w-0">
                        <label className="text-xs font-medium text-gray-600 mb-1">
                            {isReplace ? 'Re-upload file' : 'Upload file'}
                        </label>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 flex items-center h-[42px]">
                            <input
                                type="file"
                                ref={(el) => {
                                    fileRefs.current[type] = el;
                                }}
                                className="w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-gray-200 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-300 file:transition file:cursor-pointer"
                                accept={accept}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <label className="text-xs font-medium text-gray-600 mb-1">{extraField.label}</label>
                        <input
                            type={extraField.inputType}
                            value={value}
                            onChange={(e) =>
                                handleAdditionalInfoChange(
                                    type,
                                    extraField.key,
                                    extraField.upperCase ? e.target.value.toUpperCase() : e.target.value
                                )
                            }
                            className={`${inputClassName} h-[42px]${extraField.upperCase ? ' uppercase' : ''}`}
                            placeholder={extraField.placeholder}
                            maxLength={extraField.maxLength}
                        />
                    </div>
                </div>
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => handleUpload(fileRefs.current[type]?.files?.[0], type)}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-theme-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition disabled:opacity-60"
                    >
                        <FiUploadCloud className="h-4 w-4" />
                        {isLoading ? 'Uploading...' : (isReplace ? 'Re-upload' : 'Upload')}
                    </button>
                </div>
            </div>
        );
    };

    const renderMarksheetSection = () => {
        const { type, title, accept } = MARKSHEET_SECTION;
        const selectedDoc = selectedMarksheetLevel
            ? uploadedByType[getUploadKey(type, selectedMarksheetLevel)]
            : null;
        const showUploadForm = Boolean(selectedMarksheetLevel);
        const fileRefKey = getUploadKey(type, selectedMarksheetLevel);
        const isReplace = Boolean(selectedDoc);

        return (
            <div className="rounded-xl border border-gray-200 bg-white">
                <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                </div>
                <div className="px-5 py-4 space-y-4">
                    {loadingDocs ? (
                        <p className="text-sm text-gray-400">Loading…</p>
                    ) : (
                        <>
                            {MARKSHEET_LEVELS.map(({ value, label }) => {
                                const doc = uploadedByType[getUploadKey(type, value)];
                                if (!doc) return null;
                                return (
                                    <div key={value}>
                                        {renderUploadedStatus(doc, label)}
                                    </div>
                                );
                            })}

                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col min-w-0">
                                    <label className="text-xs font-medium text-gray-600 mb-1">
                                        Select Marksheet
                                    </label>
                                    <select
                                        value={selectedMarksheetLevel}
                                        onChange={(e) => setSelectedMarksheetLevel(e.target.value)}
                                        className={inputClassName}
                                    >
                                        <option value="">Select</option>
                                        {MARKSHEET_LEVELS.map(({ value, label }) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {showUploadForm ? (
                                    <>
                                        <div className="flex flex-col min-w-0">
                                            <label className="text-xs font-medium text-gray-600 mb-1">
                                                {isReplace ? 'Re-upload File' : 'Upload File'}
                                            </label>
                                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 bg-gray-50/50">
                                                <input
                                                    type="file"
                                                    ref={(el) => {
                                                        fileRefs.current[fileRefKey] = el;
                                                    }}
                                                    className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 file:transition file:cursor-pointer"
                                                    accept={accept}
                                                />
                                            </div>
                                        </div>
                                        {isReplace ? (
                                            <p className="text-xs text-gray-400">
                                                {selectedMarksheetLevel} marksheet is already uploaded. Choose a new file to replace it.
                                            </p>
                                        ) : null}
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleUpload(
                                                        fileRefs.current[fileRefKey]?.files?.[0],
                                                        type,
                                                        selectedMarksheetLevel
                                                    )
                                                }
                                                disabled={isLoading}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-theme-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition disabled:opacity-60"
                                            >
                                                <FiUploadCloud className="h-4 w-4" />
                                                {isLoading ? 'Uploading...' : (isReplace ? 'Re-upload' : 'Upload')}
                                            </button>
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full min-w-0 space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50">
                        <FiFolder className="h-4.5 w-4.5 text-blue-600" />
                    </div>
                    <h2 className="text-base font-semibold text-gray-900">Documents</h2>
                </div>
            </div>

            {DOCUMENT_SECTIONS.map((section) => {
                const uploadedDoc = uploadedByType[section.type];
                const isReplace = Boolean(uploadedDoc);
                return (
                    <div
                        key={section.type}
                        ref={section.type === 'OFFER_LETTER' ? offerLetterRef : undefined}
                        className={`rounded-xl border border-gray-200 bg-white ${
                            section.type === 'OFFER_LETTER' && highlightOfferLetter
                                ? 'job-details-offer-letter-highlight'
                                : ''
                        }`}
                    >
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
                        </div>
                        <div className="px-5 py-4 space-y-4">
                            {loadingDocs ? (
                                <p className="text-sm text-gray-400">Loading…</p>
                            ) : (
                                <>
                                    {uploadedDoc ? renderUploadedStatus(uploadedDoc) : null}
                                    {renderUploadForm(section, { isReplace })}
                                </>
                            )}
                        </div>
                    </div>
                );
            })}

            {renderMarksheetSection()}
        </div>
    );
};

export default JobDetails;
