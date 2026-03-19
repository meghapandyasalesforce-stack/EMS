import React, { useRef, useState } from 'react';
import { BOTH_DOCUMENT_ENDPOINT } from '../../utils/constant';
import { getCsrfToken } from '../../utils/authHelper';

const JobDetails = () => {
    const employeeId = localStorage.getItem('employeeId');
    const [additionalInfo, setAdditionalInfo] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const offerLetterRef = useRef(null);
    const birthCertificateRef = useRef(null);
    const guarantorFormRef = useRef(null);
    const degreeCertificateRef = useRef(null);

    const handleAdditionalInfoChange = (type, field, value) => {
        setAdditionalInfo(prev => ({
            ...prev,
            [type]: {
                ...(prev[type] || {}),
                [field]: value
            }
        }));
    };

    const handleUpload = async (file, documentType) => {
        if (!file) {
            alert(`Please select a file for ${documentType}`);
            return;
        }

        setIsLoading(true);
        
        try {
            const formData = new FormData();
            formData.append('document', file);
            formData.append('documentType', documentType);
            
            if (additionalInfo[documentType]) {
                formData.append('additionalInfo', JSON.stringify(additionalInfo[documentType]));
            }

            // Use /api prefix so Vite proxy forwards to backend (same as axios baseURL)
            const uploadUrl = BOTH_DOCUMENT_ENDPOINT.startsWith('http')
                ? `${BOTH_DOCUMENT_ENDPOINT}/document-upload`
                : `/api${BOTH_DOCUMENT_ENDPOINT}/document-upload`;
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
                    throw new Error(response.ok ? 'Invalid response from server' : (text.slice(0, 100) || `Upload failed (${response.status})`));
                }
            }

            if (!response.ok) {
                throw new Error(result.message || `Failed to upload ${documentType} (${response.status})`);
            }

            alert(`${documentType} uploaded successfully!`);
            switch(documentType) {
                case 'OFFER_LETTER':
                    offerLetterRef.current.value = '';
                    break;
                case 'BIRTH_CERTIFICATE':
                    birthCertificateRef.current.value = '';
                    break;
                case 'GUARANTOR_FORM':
                    guarantorFormRef.current.value = '';
                    break;
                case 'DEGREE_CERTIFICATE':
                    degreeCertificateRef.current.value = '';
                    break;
            }
        } catch (error) {
            // Removed console.error for production
            alert(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen transition-all duration-300">
            <div className="w-full max-w-4xl mx-auto">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6 text-center md:text-left">Job Details / Upload Documents</h2>
                <div className="space-y-4 md:space-y-6">

                    {/* Offer Letter */}
                    <div className="border p-3 md:p-4 rounded-lg bg-white shadow-sm">
                        <h3 className="font-semibold text-base md:text-lg mb-2 md:mb-3">Offer Letter</h3>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                                <label className="font-medium text-gray-700 text-sm md:text-base">Upload File</label>
                                <input 
                                    type="file" 
                                    ref={offerLetterRef} 
                                    className="border p-2 rounded w-full text-sm"
                                    accept=".pdf,.doc,.docx"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="font-medium text-gray-700 text-sm md:text-base">Effective Date</label>
                                <input
                                    type="date"
                                    value={additionalInfo.OFFER_LETTER?.effectiveDate ?? ''}
                                    onChange={(e) => handleAdditionalInfoChange('OFFER_LETTER', 'effectiveDate', e.target.value)}
                                    className="border p-2 rounded text-sm"
                                />
                            </div>
                            <button
                                onClick={() => handleUpload(offerLetterRef.current.files[0], 'OFFER_LETTER')}
                                disabled={isLoading}
                                className="bg-theme-primary text-white px-4 py-2 rounded hover:opacity-90 disabled:bg-theme-secondary text-sm md:text-base w-full md:w-auto md:self-end"
                            >
                                {isLoading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>

                    {/* Birth Certificate */}
                    <div className="border p-3 md:p-4 rounded-lg bg-white shadow-sm">
                        <h3 className="font-semibold text-base md:text-lg mb-2 md:mb-3">Birth Certificate</h3>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                                <label className="font-medium text-gray-700 text-sm md:text-base">Upload File</label>
                                <input 
                                    type="file" 
                                    ref={birthCertificateRef} 
                                    className="border p-2 rounded w-full text-sm"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                />
                            </div>
                            <button
                                onClick={() => handleUpload(birthCertificateRef.current.files[0], 'BIRTH_CERTIFICATE')}
                                disabled={isLoading}
                                className="bg-theme-primary text-white px-4 py-2 rounded hover:opacity-90 disabled:bg-theme-secondary text-sm md:text-base w-full md:w-auto md:self-end"
                            >
                                {isLoading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>

                    {/* Guarantor Form */}
                    <div className="border p-3 md:p-4 rounded-lg bg-white shadow-sm">
                        <h3 className="font-semibold text-base md:text-lg mb-2 md:mb-3">Guarantor's Form</h3>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                                <label className="font-medium text-gray-700 text-sm md:text-base">Upload File</label>
                                <input 
                                    type="file" 
                                    ref={guarantorFormRef} 
                                    className="border p-2 rounded w-full text-sm"
                                    accept=".pdf,.doc,.docx"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="font-medium text-gray-700 text-sm md:text-base">Guarantor Name</label>
                                    <input
                                        type="text"
                                        value={additionalInfo.GUARANTOR_FORM?.guarantorName ?? ''}
                                        onChange={(e) => handleAdditionalInfoChange('GUARANTOR_FORM', 'guarantorName', e.target.value)}
                                        className="border p-2 rounded text-sm"
                                        placeholder="Guarantor full name"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="font-medium text-gray-700 text-sm md:text-base">Guarantor Contact</label>
                                    <input
                                        type="text"
                                        value={additionalInfo.GUARANTOR_FORM?.guarantorContact ?? ''}
                                        onChange={(e) => handleAdditionalInfoChange('GUARANTOR_FORM', 'guarantorContact', e.target.value)}
                                        className="border p-2 rounded text-sm"
                                        placeholder="Phone or email"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => handleUpload(guarantorFormRef.current.files[0], 'GUARANTOR_FORM')}
                                disabled={isLoading}
                                className="bg-theme-primary text-white px-4 py-2 rounded hover:opacity-90 disabled:bg-theme-secondary text-sm md:text-base w-full md:w-auto md:self-end"
                            >
                                {isLoading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>

                    {/* Degree Certificate */}
                    <div className="border p-3 md:p-4 rounded-lg bg-white shadow-sm">
                        <h3 className="font-semibold text-base md:text-lg mb-2 md:mb-3">Degree Certificate</h3>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                                <label className="font-medium text-gray-700 text-sm md:text-base">Upload File</label>
                                <input 
                                    type="file" 
                                    ref={degreeCertificateRef} 
                                    className="border p-2 rounded w-full text-sm"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="font-medium text-gray-700 text-sm md:text-base">Institution</label>
                                    <input
                                        type="text"
                                        value={additionalInfo.DEGREE_CERTIFICATE?.institution ?? ''}
                                        onChange={(e) => handleAdditionalInfoChange('DEGREE_CERTIFICATE', 'institution', e.target.value)}
                                        className="border p-2 rounded text-sm"
                                        placeholder="School or university"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="font-medium text-gray-700 text-sm md:text-base">Year Obtained</label>
                                    <input
                                        type="text"
                                        value={additionalInfo.DEGREE_CERTIFICATE?.yearObtained ?? ''}
                                        onChange={(e) => handleAdditionalInfoChange('DEGREE_CERTIFICATE', 'yearObtained', e.target.value)}
                                        className="border p-2 rounded text-sm"
                                        placeholder="e.g. 2020"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => handleUpload(degreeCertificateRef.current.files[0], 'DEGREE_CERTIFICATE')}
                                disabled={isLoading}
                                className="bg-theme-primary text-white px-4 py-2 rounded hover:opacity-90 disabled:bg-theme-secondary text-sm md:text-base w-full md:w-auto md:self-end"
                            >
                                {isLoading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default JobDetails;