import React, { useState } from 'react';
import axios from '../../utils/axios';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';

const OnboardingMilestonesPanel = ({ workflow, isHRView, isManagerView, onUpdated }) => {
    const [submitting, setSubmitting] = useState(false);
    const milestones = workflow?.milestones || [];

    const submitReview = async (day, reviewerRole, feedback, rating) => {
        try {
            setSubmitting(true);
            await axios.post(
                `${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflow._id}/milestones/review`,
                { day, reviewerRole, feedback, rating: Number(rating) || undefined },
                { withCredentials: true },
            );
            toast.success(`${day}-day review submitted`);
            onUpdated?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Submit failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (!milestones.length) {
        return <p className="text-sm text-gray-500">30-60-90 milestones not configured for this workflow.</p>;
    }

    const myRole = isHRView ? 'hr' : isManagerView ? 'manager' : 'employee';

    return (
        <div className="space-y-4">
            {milestones.map((m) => (
                <div key={m.day} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <h4 className="font-semibold">{m.title || `${m.day}-Day Review`}</h4>
                            <p className="text-xs text-gray-500">
                                Due: {m.dueDate ? format(new Date(m.dueDate), 'MMM dd, yyyy') : '—'}
                                {' · '}{m.status}
                            </p>
                        </div>
                    </div>
                    <MilestoneReviewForm
                        milestone={m}
                        role={myRole}
                        submitting={submitting}
                        onSubmit={(feedback, rating) => submitReview(m.day, myRole, feedback, rating)}
                    />
                </div>
            ))}
        </div>
    );
};

const MilestoneReviewForm = ({ milestone, role, submitting, onSubmit }) => {
    const review = milestone[`${role}Review`] || {};
    const [feedback, setFeedback] = useState(review.feedback || '');
    const [rating, setRating] = useState(review.rating || '');

    if (review.status === 'Submitted') {
        return <p className="text-sm text-emerald-600 mt-2">{role} review submitted (rating: {review.rating ?? '—'})</p>;
    }

    return (
        <div className="mt-3 space-y-2">
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)}
                placeholder={`${role} feedback`}
                className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            <div className="flex gap-2 items-center">
                <select value={rating} onChange={(e) => setRating(e.target.value)} className="border rounded px-2 py-1 text-sm">
                    <option value="">Rating</option>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <button type="button" disabled={submitting || !feedback.trim()}
                    onClick={() => onSubmit(feedback, rating)}
                    className="px-3 py-1.5 bg-theme-primary text-white rounded text-sm disabled:opacity-50">
                    Submit {role} review
                </button>
            </div>
        </div>
    );
};

export default OnboardingMilestonesPanel;
