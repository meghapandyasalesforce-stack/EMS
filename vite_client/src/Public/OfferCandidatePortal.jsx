import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaCheckCircle, FaFilePdf, FaTimesCircle } from 'react-icons/fa';
import LoadingSpinner from '../components/LoadingSpinner';
import { PUBLIC_LIFECYCLE_ENDPOINT } from '../utils/constant';
import OfferLetterHtmlPreview from '../components/recruitment/OfferLetterHtmlPreview';

const OfferCandidatePortal = () => {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [offer, setOffer] = useState(null);
    const [notes, setNotes] = useState('');
    const [acceptedName, setAcceptedName] = useState('');
    const [responded, setResponded] = useState(null);
    const [showCounter, setShowCounter] = useState(false);
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
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
                    <FaTimesCircle className="mx-auto text-4xl text-red-400" />
                    <h1 className="mt-4 text-xl font-semibold text-gray-800">Offer unavailable</h1>
                    <p className="mt-2 text-sm text-gray-500">This link may have expired or already been used.</p>
                </div>
            </div>
        );
    }

    if (responded) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
                    <FaCheckCircle className={`mx-auto text-4xl ${responded === 'accept' ? 'text-emerald-500' : 'text-amber-500'}`} />
                    <h1 className="mt-4 text-xl font-semibold text-gray-800">
                        {responded === 'accept' ? 'Offer accepted' : responded === 'counter' ? 'Counter-offer sent' : 'Offer declined'}
                    </h1>
                    <p className="mt-2 text-sm text-gray-500">Thank you. HR has been notified of your response.</p>
                </div>
            </div>
        );
    }

    const candidateName = offer.candidate
        ? [offer.candidate.firstName, offer.candidate.lastName].filter(Boolean).join(' ')
        : 'Candidate';

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4">
            <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-6 border-b pb-4">
                    <p className="text-sm text-gray-500">Candidate portal</p>
                    <h1 className="text-2xl font-bold text-gray-900">Offer Letter — {offer.position}</h1>
                    <p className="mt-1 text-sm text-gray-600">For {candidateName}</p>
                </div>

                {offer.pdfUrl && (
                    <a
                        href={offer.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-6 inline-flex items-center gap-2 rounded-lg border border-theme-primary/30 px-4 py-2 text-sm font-medium text-theme-primary hover:bg-theme-primary/5"
                    >
                        <FaFilePdf /> Download PDF
                    </a>
                )}

                <div className="rounded-xl border bg-gray-50/60 p-5">
                    {(offer.templateType === 'pdf' || (!offer.bodyHtml?.trim() && offer.pdfUrl)) ? (
                        <iframe title="Offer letter" src={offer.pdfUrl} className="h-[560px] w-full rounded-lg border bg-white" />
                    ) : (
                        <OfferLetterHtmlPreview html={offer.bodyHtml || '<p>Offer details are attached as PDF.</p>'} />
                    )}
                </div>

                <div className="mt-8 space-y-4 rounded-xl border p-5">
                    <h2 className="font-semibold text-gray-800">Your response</h2>
                    <label className="block text-sm text-gray-600">
                        Comments (optional)
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                            placeholder="Any questions or notes for HR"
                        />
                    </label>
                    <label className="block text-sm text-gray-600">
                        Type your full name to accept
                        <input
                            type="text"
                            value={acceptedName}
                            onChange={(e) => setAcceptedName(e.target.value)}
                            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                            placeholder={candidateName}
                        />
                    </label>
                    <div className="flex flex-wrap gap-3 pt-2">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => respond('accept')}
                            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                            Accept offer
                        </button>
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => setShowCounter((v) => !v)}
                            className="rounded-lg border border-amber-300 px-5 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
                        >
                            Counter offer
                        </button>
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => respond('decline')}
                            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                            Decline offer
                        </button>
                    </div>
                    {showCounter && (
                        <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                            <label className="block text-sm">
                                Proposed CTC
                                <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={counterSalary} onChange={(e) => setCounterSalary(e.target.value)} />
                            </label>
                            <label className="block text-sm">
                                Preferred joining date
                                <input type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={counterStartDate} onChange={(e) => setCounterStartDate(e.target.value)} />
                            </label>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={() => respond('counter')}
                                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                Submit counter-offer
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OfferCandidatePortal;
