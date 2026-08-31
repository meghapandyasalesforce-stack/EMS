import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaDownload, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios, { getUploadUrl } from '../../utils/axios';

const formatDate = (value) =>
    value
        ? new Date(value).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
        : '—';

const BRAND_NAME = 'paarsiv';
// Letters highlighted in the primary color, mirroring the app header wordmark.
const BRAND_ACCENT_INDEXES = new Set([0, 4]);
const BRAND_PRIMARY = '#20C997';
const BRAND_DARK = '#1e293b';

const BrandWordmark = () => (
    <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
        {BRAND_NAME.split('').map((letter, index) => (
            <span
                key={`${letter}-${index}`}
                style={{ color: BRAND_ACCENT_INDEXES.has(index) ? BRAND_PRIMARY : BRAND_DARK }}
            >
                {letter}
            </span>
        ))}
    </h2>
);

const buildFileName = (certificate) => {
    const parts = ['Certificate', certificate?.courseTitle, certificate?.employeeName]
        .filter(Boolean)
        .join('-');
    const safe = parts.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return `${safe || 'Certificate'}.pdf`;
};

const CertificateModal = ({ certificate, enrollmentId, onClose }) => {
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    if (!certificate) return null;
    if (typeof document === 'undefined') return null;

    const logoUrl = getUploadUrl(certificate.organizationLogo);
    const targetEnrollmentId = enrollmentId || certificate.enrollmentId;

    const downloadCertificate = async () => {
        if (!targetEnrollmentId) {
            toast.error('Certificate download is unavailable for this enrollment');
            return;
        }
        try {
            setDownloading(true);
            const response = await axios.get(
                `/v1/both/learning/enrollments/${targetEnrollmentId}/certificate/download`,
                { responseType: 'blob', withCredentials: true }
            );

            const url = URL.createObjectURL(
                new Blob([response.data], { type: 'application/pdf' })
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = buildFileName(certificate);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            // The error body arrives as a Blob because of responseType, so read it back.
            let message = 'Failed to download certificate';
            try {
                const text = await error.response?.data?.text?.();
                if (text) message = JSON.parse(text)?.message || message;
            } catch {
                /* keep the default message */
            }
            toast.error(message);
        } finally {
            setDownloading(false);
        }
    };

    return createPortal(
        <div
            className="certificate-modal-overlay"
            role="presentation"
            onClick={onClose}
        >
            <div
                className="certificate-modal-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="certificate-modal-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 id="certificate-modal-title" className="text-lg font-bold text-slate-900 sm:text-xl">
                            Your Certificate
                        </h2>
                        <p className="mt-1 break-words text-sm text-slate-500">{certificate.courseTitle}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
                        aria-label="Close certificate"
                    >
                        <FaTimes />
                    </button>
                </div>

                <div className="certificate-modal-sheet">
                    {logoUrl ? (
                        <img
                            src={logoUrl}
                            alt={certificate.organizationName || 'Organization'}
                            className="mx-auto h-10 max-w-full object-contain sm:h-12 sm:max-w-[240px]"
                        />
                    ) : (
                        <BrandWordmark />
                    )}
                    <h3 className="mt-4 break-words text-xl font-bold text-slate-900 sm:text-3xl">
                        Certificate of Completion
                    </h3>
                    <p className="mt-4 text-sm italic text-slate-500">This is to certify that</p>
                    <p className="mx-auto mt-2 max-w-full break-words border-b-2 border-slate-200 px-2 pb-2 text-xl font-semibold text-slate-900 sm:inline-block sm:px-6 sm:text-2xl">
                        {certificate.employeeName}
                    </p>
                    <p className="mt-4 text-sm italic text-slate-500">
                        has successfully completed the course
                    </p>
                    <p className="mt-2 break-words text-base font-bold text-slate-900 sm:text-lg">
                        {certificate.courseTitle}
                    </p>
                    {certificate.courseProvider && (
                        <p className="mt-1 break-words text-sm text-slate-500">
                            delivered by {certificate.courseProvider}
                        </p>
                    )}

                    <div className="mt-8 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                        {[
                            { label: 'Completed on', value: formatDate(certificate.completedDate) },
                            { label: 'Issued on', value: formatDate(certificate.issuedDate) },
                            {
                                label: 'Valid until',
                                value: certificate.expiryDate
                                    ? formatDate(certificate.expiryDate)
                                    : 'No expiry'
                            }
                        ].map((item) => (
                            <div key={item.label} className="min-w-0">
                                <p className="break-words font-semibold text-slate-900">{item.value}</p>
                                <p className="text-xs text-slate-500">{item.label}</p>
                            </div>
                        ))}
                    </div>

                    <p className="mt-6 break-all text-[11px] tracking-wider text-slate-400">
                        Certificate ID: {certificate.certificateId}
                    </p>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 sm:w-auto"
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={downloadCertificate}
                        disabled={downloading}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0d9488] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                    >
                        <FaDownload /> {downloading ? 'Preparing PDF...' : 'Download PDF'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CertificateModal;
