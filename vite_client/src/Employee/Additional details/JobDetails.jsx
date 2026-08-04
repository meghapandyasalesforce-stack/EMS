import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BOTH_DOCUMENTS_ENDPOINT, BOTH_PROFILE_ENDPOINT } from '../../utils/constant';
import { getCsrfToken } from '../../utils/authHelper';
import axios from '../../utils/axios';

const MARKSHEET_LEVELS = [
    { value: '10th', label: '10th' },
    { value: '12th', label: '12th' },
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
        title: 'Aadhar Card',
        accept: '.pdf,.jpg,.jpeg,.png',
        extraField: {
            key: 'aadharNumber',
            label: 'Aadhar Number',
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

    // Clear one-time first-login redirect; highlight Offer Letter when opened from that flow
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
            alert('Please select a marksheet level (10th, 12th, Graduation, or Post Graduation) before uploading.');
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
            <div className="mb-3 flex flex-col gap-2 rounded-md border border-slate-100 bg-slate-50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className={`text-sm font-medium ${isRejected ? 'text-red-700' : 'text-emerald-700'}`}>
                            {levelLabel ? `${levelLabel} — ` : ''}
                            {isRejected ? 'Rejected' : 'Uploaded'}
                        </p>
                        {doc.fileName ? (
                            <p className="mt-0.5 text-sm text-gray-600 truncate max-w-md">{doc.fileName}</p>
                        ) : null}
                    </div>
                    <span
                        className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClass(label)}`}
                    >
                        {label}
                    </span>
                </div>
                {isRejected && doc.rejectionReason ? (
                    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        Reason: {doc.rejectionReason}
                    </p>
                ) : null}
            </div>
        );
    };

    const renderUploadForm = (section) => {
        const { type, accept, extraField } = section;
        const value = additionalInfo[type]?.[extraField.key] ?? '';

        return (
            <div className="flex flex-col gap-3">
                <div className="hrms-form-grid">
                <div className="flex flex-col gap-2 min-w-0">
                    <label className="font-medium text-gray-700 text-sm md:text-base">Upload File</label>
                    <input
                        type="file"
                        ref={(el) => {
                            fileRefs.current[type] = el;
                        }}
                        className="w-full max-w-full border p-2 rounded text-sm"
                        accept={accept}
                    />
                </div>
                <div className="flex flex-col gap-2 min-w-0">
                    <label className="font-medium text-gray-700 text-sm md:text-base">{extraField.label}</label>
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
                        className={`w-full max-w-full border p-2 rounded text-sm${extraField.upperCase ? ' uppercase' : ''}`}
                        placeholder={extraField.placeholder}
                        maxLength={extraField.maxLength}
                    />
                </div>
                </div>
                <button
                    type="button"
                    onClick={() => handleUpload(fileRefs.current[type]?.files?.[0], type)}
                    disabled={isLoading}
                    className="bg-theme-primary text-white px-4 py-2 rounded hover:opacity-90 disabled:bg-theme-secondary text-sm md:text-base w-full md:w-auto md:self-end"
                >
                    {isLoading ? 'Uploading...' : 'Upload'}
                </button>
            </div>
        );
    };

    const renderMarksheetSection = () => {
        const { type, title, accept } = MARKSHEET_SECTION;
        const selectedDoc = selectedMarksheetLevel
            ? uploadedByType[getUploadKey(type, selectedMarksheetLevel)]
            : null;
        const isRejected = selectedDoc?.approvalStatus === 'Rejected';
        const showUploadForm = selectedMarksheetLevel && (!selectedDoc || isRejected);
        const fileRefKey = getUploadKey(type, selectedMarksheetLevel);

        return (
            <div className="border p-3 md:p-4 rounded-lg bg-white shadow-sm">
                <h3 className="font-semibold text-base md:text-lg mb-2 md:mb-3">{title}</h3>
                {loadingDocs ? (
                    <p className="text-sm text-gray-500">Loading…</p>
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

                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                                <label className="font-medium text-gray-700 text-sm md:text-base">
                                    Select Marksheet
                                </label>
                                <select
                                    value={selectedMarksheetLevel}
                                    onChange={(e) => setSelectedMarksheetLevel(e.target.value)}
                                    className="w-full max-w-full border p-2 rounded text-sm"
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
                                    <div className="flex flex-col gap-2">
                                        <label className="font-medium text-gray-700 text-sm md:text-base">
                                            Upload File
                                        </label>
                                        <input
                                            type="file"
                                            ref={(el) => {
                                                fileRefs.current[fileRefKey] = el;
                                            }}
                                            className="w-full max-w-full border p-2 rounded text-sm"
                                            accept={accept}
                                        />
                                    </div>
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
                                        className="bg-theme-primary text-white px-4 py-2 rounded hover:opacity-90 disabled:bg-theme-secondary text-sm md:text-base w-full md:w-auto md:self-end"
                                    >
                                        {isLoading ? 'Uploading...' : 'Upload'}
                                    </button>
                                </>
                            ) : selectedMarksheetLevel && selectedDoc && !isRejected ? (
                                <p className="text-sm text-gray-500">
                                    {selectedMarksheetLevel} marksheet is already uploaded. Select another level to upload more.
                                </p>
                            ) : null}
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="w-full min-w-0">
            <div className="w-full">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6 text-left">
                    Documents
                </h2>
                <div className="space-y-3 sm:space-y-4 md:space-y-5">
                    {DOCUMENT_SECTIONS.map((section) => {
                        const uploadedDoc = uploadedByType[section.type];
                        const isRejected = uploadedDoc?.approvalStatus === 'Rejected';
                        const showUploadForm = !uploadedDoc || isRejected;
                        return (
                            <div
                                key={section.type}
                                ref={section.type === 'OFFER_LETTER' ? offerLetterRef : undefined}
                                className={`border p-3 md:p-4 rounded-lg bg-white shadow-sm ${
                                    section.type === 'OFFER_LETTER' && highlightOfferLetter
                                        ? 'job-details-offer-letter-highlight'
                                        : ''
                                }`}
                            >
                                <h3 className="font-semibold text-base md:text-lg mb-2 md:mb-3">{section.title}</h3>
                                {loadingDocs ? (
                                    <p className="text-sm text-gray-500">Loading…</p>
                                ) : (
                                    <>
                                        {uploadedDoc ? renderUploadedStatus(uploadedDoc) : null}
                                        {showUploadForm ? renderUploadForm(section) : null}
                                    </>
                                )}
                            </div>
                        );
                    })}
                    {renderMarksheetSection()}
                </div>
            </div>
        </div>
    );
};

export default JobDetails;
