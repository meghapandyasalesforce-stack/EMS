import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaCheckCircle, FaFilePdf, FaTimesCircle } from 'react-icons/fa';
import LoadingSpinner from '../components/LoadingSpinner';
import axios from '../utils/axios';
import { PUBLIC_LIFECYCLE_ENDPOINT } from '../utils/constant';
import OfferLetterHtmlPreview from '../components/recruitment/OfferLetterHtmlPreview';
import { CmButton } from '../components/recruitment/atsUi';

const OfferCandidatePortal = () => {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [offer, setOffer] = useState(null);
    const [notes, setNotes] = useState('');
    const [acceptedName, setAcceptedName] = useState('');
    const [responded, setResponded] = useState(null);
    const [counterSalary, setCounterSalary] = useState('');
    const [counterStartDate, setCounterStartDate] = useState('');

    const fetchOffer = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${PUBLIC_LIFECYCLE_ENDPOINT}/offer/${token}`);
            setOffer(response.data?.data || null);
            if (response.data?.data?.salary) setCounterSalary(String(response.data.data.salary));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to load offer');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchOffer();
    }, [fetchOffer]);

    const respond = async (action) => {
        if (action === 'accept' && !acceptedName.trim()) {
            toast.error('Please type your full name to accept');
            return;
        }
        setSubmitting(true);
        try {
            await axios.post(`${PUBLIC_LIFECYCLE_ENDPOINT}/offer/${token}`, {
                action,
                notes,
                signatureData: action === 'accept' ? { typedName: acceptedName.trim() } : undefined,
                counterOffer: action === 'counter' ? {
                    salary: counterSalary ? Number(counterSalary) : undefined,
                    startDate: counterStartDate || undefined,
                    notes,
                } : undefined,
            });
            setResponded(action);
            const msgs = { accept: 'Offer accepted successfully', decline: 'Offer declined', counter: 'Counter-offer submitted' };
            toast.success(msgs[action] || 'Response submitted');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to submit response');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading offer letter..." />;

    if (!offer) {
        return (
            <div className="cm-hrms ats-ui ats-public-shell flex min-h-screen items-center justify-center p-6">
                <div className="cm-card max-w-md text-center">
                    <div
                        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl"
                        style={{ background: 'rgba(229,62,62,0.12)', color: 'var(--ats-error)' }}
                    >
                        <FaTimesCircle />
                    </div>
                    <h1 className="mt-4 text-xl font-semibold" style={{ color: 'var(--ats-secondary)' }}>Offer unavailable</h1>
                    <p className="mt-2 text-sm" style={{ color: 'rgba(15,45,38,0.55)' }}>This link may have expired or already been used.</p>
                </div>
            </div>
        );
    }

    if (responded) {
        const toneBg = responded === 'accept' ? 'rgba(28,202,155,0.15)' : 'rgba(255,127,80,0.15)';
        const toneColor = responded === 'accept' ? '#006c51' : '#c45a2a';
        return (
            <div className="cm-hrms ats-ui ats-public-shell flex min-h-screen items-center justify-center p-6">
                <div className="cm-card max-w-md text-center">
                    <div
                        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl"
                        style={{ background: toneBg, color: toneColor }}
                    >
                        <FaCheckCircle />
                    </div>
                    <h1 className="mt-4 text-xl font-semibold" style={{ color: 'var(--ats-secondary)' }}>
                        {responded === 'accept' ? 'Offer accepted' : responded === 'counter' ? 'Counter-offer sent' : 'Offer declined'}
                    </h1>
                    <p className="mt-2 text-sm" style={{ color: 'rgba(15,45,38,0.55)' }}>Thank you. HR has been notified of your response.</p>
                </div>
            </div>
        );
    }

    const candidateName = offer.candidate
        ? [offer.candidate.firstName, offer.candidate.lastName].filter(Boolean).join(' ')
        : 'Candidate';

    return (
        <div className="cm-hrms ats-ui ats-public-shell">
            <header className="ats-public-header">
                <div className="ats-public-header__inner">
                    <p className="text-sm font-medium text-theme-secondary">Candidate portal</p>
                    <h1 className="mt-1 text-2xl font-bold leading-tight text-gray-800 sm:text-3xl">Offer Letter — {offer.position}</h1>
                    <p className="mt-2 text-sm text-gray-500">For {candidateName}</p>
                </div>
            </header>

            <main className="ats-public-main space-y-6">
                <div className="ats-stat-grid">
                    <div className="cm-card !p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(15,45,38,0.45)' }}>Annual CTC</p>
                        <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--ats-secondary)' }}>
                            {offer.salary ? `Rs ${Number(offer.salary).toLocaleString('en-IN')}` : '—'}
                        </p>
                    </div>
                    <div className="cm-card !p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(15,45,38,0.45)' }}>Joining date</p>
                        <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--ats-secondary)' }}>
                            {offer.startDate ? new Date(offer.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </p>
                    </div>
                    <div className="cm-card !p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(15,45,38,0.45)' }}>Valid until</p>
                        <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--ats-secondary)' }}>
                            {offer.expiryDate ? new Date(offer.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </p>
                    </div>
                </div>

                {offer.pdfUrl && (
                    <a
                        href={offer.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ats-link inline-flex items-center gap-2"
                    >
                        <FaFilePdf /> View / Download PDF
                    </a>
                )}

                {offer.bodyHtml?.trim() && offer.templateType !== 'pdf' && (
                    <div className="cm-card">
                        <OfferLetterHtmlPreview html={offer.bodyHtml} />
                    </div>
                )}

                <div className="cm-card space-y-4">
                    <h2 className="cm-title-sm">Your response</h2>
                    <label className="block">
                        <span className="ats-form-label">Comments (optional)</span>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="cm-input w-full !rounded-lg"
                            placeholder="Any questions or notes for HR"
                        />
                    </label>
                    <label className="block">
                        <span className="ats-form-label">Type your full name to accept</span>
                        <input
                            type="text"
                            value={acceptedName}
                            onChange={(e) => setAcceptedName(e.target.value)}
                            className="cm-input w-full"
                            placeholder={candidateName}
                        />
                    </label>
                    <div className="space-y-3 rounded-xl p-4" style={{ background: 'rgba(255,127,80,0.08)', border: '1px solid rgba(255,127,80,0.25)' }}>
                        <p className="text-sm font-semibold" style={{ color: '#c45a2a' }}>Counter offer (optional)</p>
                        <label className="block">
                            <span className="ats-form-label">Proposed CTC</span>
                            <input type="number" className="cm-input w-full" value={counterSalary} onChange={(e) => setCounterSalary(e.target.value)} />
                        </label>
                        <label className="block">
                            <span className="ats-form-label">Preferred joining date</span>
                            <input type="date" className="cm-input w-full" value={counterStartDate} onChange={(e) => setCounterStartDate(e.target.value)} />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-3 pt-2">
                        <CmButton type="button" disabled={submitting} onClick={() => respond('accept')}>
                            Accept offer
                        </CmButton>
                        <CmButton type="button" variant="tertiary" disabled={submitting} onClick={() => respond('counter')}>
                            Submit counter-offer
                        </CmButton>
                        <CmButton type="button" variant="outline" disabled={submitting} onClick={() => respond('decline')}>
                            Decline offer
                        </CmButton>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default OfferCandidatePortal;
