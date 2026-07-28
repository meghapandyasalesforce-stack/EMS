import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
    FaArrowLeft, FaBriefcase, FaCalendarAlt, FaFileContract, FaUser,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import OfferLetterPanel from '../../components/recruitment/OfferLetterPanel';

const TABS = [
    { id: 'overview', label: 'Overview', icon: FaUser },
    { id: 'offer', label: 'Offer Letter', icon: FaFileContract },
];

const CandidateDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [candidate, setCandidate] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    const fetchCandidate = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`/v1/admin/recruitment/candidates/${id}`, { withCredentials: true });
            if (!data.success || !data.data) {
                toast.error('Candidate not found');
                navigate('/recruitment');
                return;
            }
            setCandidate(data.data);
        } catch {
            toast.error('Failed to load candidate');
            navigate('/recruitment');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => { fetchCandidate(); }, [fetchCandidate]);

    if (loading) return <LoadingSpinner message="Loading candidate..." />;
    if (!candidate) return null;

    const fullName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ');

    return (
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
            <div className="w-full">
                <button
                    type="button"
                    onClick={() => navigate('/recruitment')}
                    className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                    <FaArrowLeft /> Back to Recruitment
                </button>

                <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
                            <p className="mt-1 text-sm text-gray-600">{candidate.email}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-sm text-gray-600">
                                <span className="inline-flex items-center gap-1"><FaBriefcase /> {candidate.jobPostingId?.jobTitle || 'No job linked'}</span>
                                <span className="inline-flex items-center gap-1"><FaCalendarAlt /> Applied {candidate.applicationDate ? format(new Date(candidate.applicationDate), 'dd MMM yyyy') : '—'}</span>
                            </div>
                        </div>
                        <span className={`self-start rounded-full px-3 py-1 text-sm font-semibold ${
                            candidate.status === 'Offer Accepted' ? 'bg-emerald-100 text-emerald-800'
                                : candidate.status === 'Rejected' ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                        }`}>
                            {candidate.status}
                        </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1 border-t border-gray-100 pt-4">
                        {TABS.map(({ id: tabId, label, icon: Icon }) => (
                            <button
                                key={tabId}
                                type="button"
                                onClick={() => setActiveTab(tabId)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                                    activeTab === tabId ? 'bg-theme-primary/10 text-theme-primary' : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                <Icon className="text-xs" /> {label}
                            </button>
                        ))}
                    </div>
                </section>

                {activeTab === 'overview' && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                            <h2 className="mb-4 text-lg font-semibold text-gray-800">Candidate Profile</h2>
                            <dl className="space-y-3 text-sm">
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Phone</dt><dd className="font-medium text-gray-800">{candidate.phone || '—'}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Stage</dt><dd className="font-medium text-gray-800">{candidate.stage || '—'}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Department</dt><dd className="font-medium text-gray-800">{candidate.jobPostingId?.department || '—'}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Source</dt><dd className="font-medium text-gray-800">{candidate.source || '—'}</dd></div>
                            </dl>
                        </section>
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                            <h2 className="mb-4 text-lg font-semibold text-gray-800">Interviews</h2>
                            {(candidate.interviewSchedule || []).length ? (
                                <div className="space-y-3">
                                    {candidate.interviewSchedule.map((item, index) => (
                                        <div key={index} className="rounded-lg border p-3 text-sm">
                                            <p className="font-medium">{item.type || 'Interview'} — {item.status || 'Scheduled'}</p>
                                            <p className="text-gray-500">{item.scheduledDate ? format(new Date(item.scheduledDate), 'dd MMM yyyy HH:mm') : ''}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-sm text-gray-500">No interviews scheduled.</p>}
                        </section>
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
                            <h2 className="mb-4 text-lg font-semibold text-gray-800">Notes</h2>
                            {(candidate.notes || []).length ? (
                                <div className="space-y-2">
                                    {candidate.notes.map((note, index) => (
                                        <div key={index} className="rounded-lg bg-gray-50 p-3 text-sm">
                                            <p>{note.note}</p>
                                            <p className="mt-1 text-xs text-gray-500">{note.addedAt ? format(new Date(note.addedAt), 'dd MMM yyyy') : ''}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-sm text-gray-500">No notes added.</p>}
                        </section>
                    </div>
                )}

                {activeTab === 'offer' && (
                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <OfferLetterPanel candidateId={candidate._id} candidate={candidate} onRefresh={fetchCandidate} />
                    </section>
                )}
            </div>
        </div>
    );
};

export default CandidateDetailPage;
