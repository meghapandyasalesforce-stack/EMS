import React, { useRef, useState } from 'react';
import { BOTH_DOCUMENTS_ENDPOINT } from '../../utils/constant';
import { getCsrfToken } from '../../utils/authHelper';

const JobDetails = () => {
    const employeeId = localStorage.getItem('employeeId');
    const [additionalInfo, setAdditionalInfo] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const offerLetterRef = useRef(null);
    const aadharCardRef = useRef(null);
    const panCardRef = useRef(null);

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

            // Canonical employee uploads → Document collection (HR /documents list)
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
                    throw new Error(response.ok ? 'Invalid response from server' : (text.slice(0, 100) || `Upload failed (${response.status})`));
                }
            }

            if (!response.ok) {
                throw new Error(result.message || `Failed to upload ${documentType} (${response.status})`);
            }

            alert(result.message || `${documentType} uploaded successfully!`);
            switch(documentType) {
                case 'OFFER_LETTER':
                    offerLetterRef.current.value = '';
                    break;
                case 'AADHAR_CARD':
                    aadharCardRef.current.value = '';
                    break;
                case 'PAN_CARD':
                    panCardRef.current.value = '';
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

                    {/* Aadhar Card */}
                    <div className="border p-3 md:p-4 rounded-lg bg-white shadow-sm">
                        <h3 className="font-semibold text-base md:text-lg mb-2 md:mb-3">Aadhar Card</h3>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                                <label className="font-medium text-gray-700 text-sm md:text-base">Upload File</label>
                                <input 
                                    type="file" 
                                    ref={aadharCardRef} 
                                    className="border p-2 rounded w-full text-sm"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="font-medium text-gray-700 text-sm md:text-base">Aadhar Number</label>
                                <input
                                    type="text"
                                    value={additionalInfo.AADHAR_CARD?.aadharNumber ?? ''}
                                    onChange={(e) => handleAdditionalInfoChange('AADHAR_CARD', 'aadharNumber', e.target.value)}
                                    className="border p-2 rounded text-sm"
                                    placeholder="XXXX XXXX XXXX"
                                    maxLength={14}
                                />
                            </div>
                            <button
                                onClick={() => handleUpload(aadharCardRef.current.files[0], 'AADHAR_CARD')}
                                disabled={isLoading}
                                className="bg-theme-primary text-white px-4 py-2 rounded hover:opacity-90 disabled:bg-theme-secondary text-sm md:text-base w-full md:w-auto md:self-end"
                            >
                                {isLoading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>

                    {/* Pan Card */}
                    <div className="border p-3 md:p-4 rounded-lg bg-white shadow-sm">
                        <h3 className="font-semibold text-base md:text-lg mb-2 md:mb-3">Pan Card</h3>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                                <label className="font-medium text-gray-700 text-sm md:text-base">Upload File</label>
                                <input 
                                    type="file" 
                                    ref={panCardRef} 
                                    className="border p-2 rounded w-full text-sm"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="font-medium text-gray-700 text-sm md:text-base">PAN Number</label>
                                <input
                                    type="text"
                                    value={additionalInfo.PAN_CARD?.panNumber ?? ''}
                                    onChange={(e) => handleAdditionalInfoChange('PAN_CARD', 'panNumber', e.target.value.toUpperCase())}
                                    className="border p-2 rounded text-sm uppercase"
                                    placeholder="ABCDE1234F"
                                    maxLength={10}
                                />
                            </div>
                            <button
                                onClick={() => handleUpload(panCardRef.current.files[0], 'PAN_CARD')}
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
